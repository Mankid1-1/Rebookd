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

const MODEL = "gemini-2.5-flash";
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "15000", 10);
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

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }
  return { role, name, content: contentParts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined,
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools || tools.length !== 1) {
      throw new Error("tool_choice 'required' needs exactly one configured tool");
    }
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }
  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

async function getBreakerState() {
  const db = await getDb();
  if (!db) return { db: null as any, breaker: null as any };
  const [breaker] = await db
    .select()
    .from(llmCircuitBreakers)
    .where(and(eq(llmCircuitBreakers.provider, "forge"), eq(llmCircuitBreakers.model, MODEL)))
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
      provider: "forge",
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
    provider: "forge",
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

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();
  await assertCircuitAvailable();

  const { messages, tools, toolChoice, tool_choice, outputSchema, output_schema, responseFormat, response_format } = params;

  const payload: Record<string, unknown> = {
    model: MODEL,
    messages: messages.map(normalizeMessage),
  };

  if (tools?.length) payload.tools = tools;

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

  payload.max_tokens = 32768;
  payload.thinking = { budget_tokens: 128 };

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  if (normalizedResponseFormat) (payload as any).response_format = normalizedResponseFormat;

  let lastError: unknown;

  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch(resolveApiUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENV.forgeApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await readResponseTextWithTimeout(response, LLM_TIMEOUT_MS);
        throw new AppError(
          "LLM_UPSTREAM_ERROR",
          `LLM invoke failed: ${response.status} ${response.statusText} - ${errorText}`,
          502,
          true,
        );
      }

      const bodyText = await readResponseTextWithTimeout(response, LLM_TIMEOUT_MS);
      let result: InvokeResult;
      try {
        result = JSON.parse(bodyText) as InvokeResult;
      } catch {
        throw new AppError("LLM_UPSTREAM_ERROR", "LLM returned invalid JSON", 502, true);
      }
      await recordCircuitResult(true);
      return result;
    } catch (error) {
      lastError = error;
      await recordCircuitResult(false);
      logger.warn("LLM invocation attempt failed", {
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
    throw new AppError("LLM_TIMEOUT", `LLM timed out after ${LLM_TIMEOUT_MS}ms`, 504, true);
  }
  throw new AppError("LLM_UPSTREAM_ERROR", "LLM request failed", 502, true);
}
