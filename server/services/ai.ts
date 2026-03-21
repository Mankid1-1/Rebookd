import { invokeLLM } from "../_core/llm";

export async function rewriteMessage(message: string, tone?: string): Promise<string> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Expert SMS copywriter. Rewrite in ${tone ?? "friendly"} tone. Under 160 chars. Return ONLY the message.`,
      },
      { role: "user", content: message },
    ],
  });
  const content = result.choices?.[0]?.message?.content || (result as any).text || "";
  return content.trim();
}
