import { and, eq } from "drizzle-orm";
import { llmCircuitBreakers } from "../../drizzle/schema";
import { ENV } from "./env";
import { AppError } from "./appErrors";
import { logger } from "./logger";
import { getDb } from "../db";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "30000", 10);
const LLM_MAX_ATTEMPTS = parseInt(process.env.LLM_MAX_ATTEMPTS || "2", 10);
const LLM_BREAKER_THRESHOLD = parseInt(process.env.LLM_BREAKER_THRESHOLD || "3", 10);
const LLM_BREAKER_COOLDOWN_MS = parseInt(process.env.LLM_BREAKER_COOLDOWN_MS || "60000", 10);

async function readResponseTextWithTimeout(response: Response, ms: number): Promise<string> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      response.text(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new AppError("LLM_TIMEOUT", `Response body exceeded ${ms}ms`, 504, true)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const assertApiKey = () => {
  if (!ENV.anthropicApiKey) {
    throw new AppError(
      "LLM_UPSTREAM_ERROR",
      "ANTHROPIC_API_KEY is not configured — AI features unavailable",
      503,
      true,
    );
  }
};

// ─── Convert our Message[] to Claude Messages API format ───────────────────

type ClaudeContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ClaudeContent[];
};

function convertMessages(messages: Message[]): { system: string | undefined; messages: ClaudeMessage[] } {
  let system: string | undefined;
  const claudeMessages: ClaudeMessage[] = [];

  for (const msg of messages) {
    // Extract system prompt
    if (msg.role === "system") {
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(p => typeof p === "string" ? p : "text" in p ? p.text : "").join("\n")
          : "text" in msg.content ? msg.content.text : "";
      system = system ? `${system}\n\n${text}` : text;
      continue;
    }

    // Convert tool/function results to user messages with tool_result
    if (msg.role === "tool" || msg.role === "function") {
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(p => typeof p === "string" ? p : JSON.stringify(p)).join("\n")
          : JSON.stringify(msg.content);
      claudeMessages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: msg.tool_call_id || "unknown", content: text }],
      });
      continue;
    }

    // Map role
    const role: "user" | "assistant" = msg.role === "assistant" ? "assistant" : "user";

    // Convert content
    if (typeof msg.content === "string") {
      claudeMessages.push({ role, content: msg.content });
      continue;
    }

    const parts = Array.isArray(msg.content) ? msg.content : [msg.content];
    const claudeParts: ClaudeContent[] = [];

    for (const part of parts) {
      if (typeof part === "string") {
        claudeParts.push({ type: "text", text: part });
      } else if (part.type === "text") {
        claudeParts.push({ type: "text", text: part.text });
      } else if (part.type === "image_url") {
        claudeParts.push({ type: "image", source: { type: "url", url: part.image_url.url } });
      } else {
        // file_url — pass as text reference
        claudeParts.push({ type: "text", text: `[File: ${part.file_url.url}]` });
      }
    }

    claudeMessages.push({ role, content: claudeParts });
  }

  // Claude requires messages to start with a user message
  if (claudeMessages.length > 0 && claudeMessages[0].role === "assistant") {
    claudeMessages.unshift({ role: "user", content: "Continue." });
  }

  return { system, messages: claudeMessages };
}

// ─── Convert tools to Claude format ────────────────────────────────────────

function convertTools(tools: Tool[] | undefined): object[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description || "",
    input_schema: t.function.parameters || { type: "object", properties: {} },
  }));
}

function convertToolChoice(
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined,
): object | undefined {
  if (!toolChoice) return undefined;
  if (toolChoice === "none") return { type: "none" };
  if (toolChoice === "auto") return { type: "auto" };
  if (toolChoice === "required") {
    if (tools?.length === 1) return { type: "tool", name: tools[0].function.name };
    return { type: "any" };
  }
  if ("name" in toolChoice) return { type: "tool", name: toolChoice.name };
  if ("function" in toolChoice) return { type: "tool", name: toolChoice.function.name };
  return undefined;
}

// ─── Convert Claude response to our InvokeResult format ────────────────────

function convertResponse(claudeResponse: any): InvokeResult {
  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of claudeResponse.content || []) {
    if (block.type === "text") {
      textParts.push(block.text);
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      });
    }
  }

  const finishReason = claudeResponse.stop_reason === "end_turn" ? "stop"
    : claudeResponse.stop_reason === "tool_use" ? "tool_calls"
    : claudeResponse.stop_reason || "stop";

  return {
    id: claudeResponse.id || `msg_${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: claudeResponse.model || MODEL,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: textParts.join(""),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: finishReason,
    }],
    usage: claudeResponse.usage ? {
      prompt_tokens: claudeResponse.usage.input_tokens || 0,
      completion_tokens: claudeResponse.usage.output_tokens || 0,
      total_tokens: (claudeResponse.usage.input_tokens || 0) + (claudeResponse.usage.output_tokens || 0),
    } : undefined,
  };
}

// ─── Circuit breaker ───────────────────────────────────────────────────────

async function getBreakerState() {
  const db = await getDb();
  if (!db) return { db: null as any, breaker: null as any };
  const [breaker] = await db
    .select()
    .from(llmCircuitBreakers)
    .where(and(eq(llmCircuitBreakers.provider, "anthropic"), eq(llmCircuitBreakers.model, MODEL)))
    .limit(1);
  return { db: db as any, breaker };
}

async function assertCircuitAvailable() {
  const { db, breaker } = await getBreakerState();
  if (!db || !breaker) return;
  if (breaker.state !== "open") return;

  const cooldownUntil = breaker.cooldownUntil ? new Date(breaker.cooldownUntil).getTime() : 0;
  if (cooldownUntil > Date.now()) {
    throw new AppError("LLM_CIRCUIT_OPEN", "AI rewrite temporarily unavailable", 503, true);
  }

  await db
    .update(llmCircuitBreakers)
    .set({ state: "half_open", updatedAt: new Date() })
    .where(eq(llmCircuitBreakers.id, breaker.id));
}

async function recordCircuitResult(success: boolean) {
  const { db, breaker } = await getBreakerState();
  if (!db) return;

  if (success) {
    const payload = {
      provider: "anthropic",
      model: MODEL,
      state: "closed" as const,
      consecutiveFailures: 0,
      openedAt: null,
      cooldownUntil: null,
      updatedAt: new Date(),
    };
    if (breaker) {
      await db.update(llmCircuitBreakers).set(payload).where(eq(llmCircuitBreakers.id, breaker.id));
    } else {
      await db.insert(llmCircuitBreakers).values(payload);
    }
    return;
  }

  const nextFailures = (breaker?.consecutiveFailures || 0) + 1;
  const shouldOpen = nextFailures >= LLM_BREAKER_THRESHOLD;
  const payload = {
    provider: "anthropic",
    model: MODEL,
    state: shouldOpen ? "open" as const : "closed" as const,
    consecutiveFailures: nextFailures,
    openedAt: shouldOpen ? new Date() : null,
    cooldownUntil: shouldOpen ? new Date(Date.now() + LLM_BREAKER_COOLDOWN_MS) : null,
    updatedAt: new Date(),
  };

  if (breaker) {
    await db.update(llmCircuitBreakers).set(payload).where(eq(llmCircuitBreakers.id, breaker.id));
  } else {
    await db.insert(llmCircuitBreakers).values(payload);
  }
}

// ─── Main invocation ───────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();
  await assertCircuitAvailable();

  const { messages, tools, toolChoice, tool_choice, maxTokens, max_tokens } = params;
  const { system, messages: claudeMessages } = convertMessages(messages);

  const payload: Record<string, unknown> = {
    model: MODEL,
    max_tokens: maxTokens || max_tokens || 4096,
    messages: claudeMessages,
  };

  if (system) payload.system = system;

  const claudeTools = convertTools(tools);
  if (claudeTools) payload.tools = claudeTools;

  const resolvedToolChoice = convertToolChoice(toolChoice || tool_choice, tools);
  if (resolvedToolChoice) payload.tool_choice = resolvedToolChoice;

  let lastError: unknown;

  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ENV.anthropicApiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await readResponseTextWithTimeout(response, LLM_TIMEOUT_MS);
        throw new AppError(
          "LLM_UPSTREAM_ERROR",
          `Claude API error: ${response.status} ${response.statusText} - ${errorText}`,
          502,
          true,
        );
      }

      const bodyText = await readResponseTextWithTimeout(response, LLM_TIMEOUT_MS);
      let claudeResult: any;
      try {
        claudeResult = JSON.parse(bodyText);
      } catch {
        throw new AppError("LLM_UPSTREAM_ERROR", "Claude returned invalid JSON", 502, true);
      }

      await recordCircuitResult(true);
      return convertResponse(claudeResult);
    } catch (error) {
      lastError = error;
      await recordCircuitResult(false);
      logger.warn("Claude API invocation attempt failed", {
        attempt,
        timeout: error instanceof Error && error.name === "AbortError",
        error: String(error),
      });
      if (attempt >= LLM_MAX_ATTEMPTS) break;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof AppError) throw lastError;
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new AppError("LLM_TIMEOUT", `Claude timed out after ${LLM_TIMEOUT_MS}ms`, 504, true);
  }
  throw new AppError("LLM_UPSTREAM_ERROR", "Claude API request failed", 502, true);
}
