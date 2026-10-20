import "server-only";

/** Chamadas de IA compartilhadas (Gemini e Claude), com tempo limite. Quem chama trata as falhas. */

export type AiSource = "gemini" | "claude";

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(res.status === 429 ? "limite de uso atingido (429)" : `HTTP ${res.status} ${detail.slice(0, 120)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

type Opts = { maxTokens: number; timeoutMs: number; json?: boolean };

/** Claude (Anthropic). Precisa de ANTHROPIC_API_KEY; modelo em ANTHROPIC_MODEL. */
export async function claudeText(system: string, prompt: string, o: Opts): Promise<string> {
  const body = (await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    { model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: o.maxTokens, system, messages: [{ role: "user", content: prompt }] },
    o.timeoutMs,
  )) as { content?: { type: string; text?: string }[] };
  return body.content?.find((c) => c.type === "text")?.text ?? "";
}

/** Gemini (Google AI Studio, tem faixa gratuita). Precisa de GEMINI_API_KEY; modelo em GEMINI_MODEL. */
export async function geminiText(system: string, prompt: string, o: Opts): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const body = (await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { ...(o.json && { responseMimeType: "application/json" }), maxOutputTokens: o.maxTokens, temperature: 0.4 },
    },
    o.timeoutMs,
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

export const AI_PROVIDERS: { source: AiSource; enabled: () => boolean; call: typeof geminiText }[] = [
  { source: "gemini", enabled: () => !!process.env.GEMINI_API_KEY, call: geminiText },
  { source: "claude", enabled: () => !!process.env.ANTHROPIC_API_KEY, call: claudeText },
];

/** Extrai o primeiro objeto JSON de um texto. */
export function extractJson(text: string): unknown {
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}
