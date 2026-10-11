import "server-only";
import type { AiSource, ReportStudent } from "@/lib/report";

const SYSTEM = `Você é um treinador de musculação experiente ajudando um Personal Trainer brasileiro.
Para cada aluno, escreva de 2 a 4 sugestões curtas e práticas de estratégia para a próxima semana, em português do Brasil,
com base nos dados da semana (frequência, cargas que aumentaram/mantiveram/diminuíram, recordes, sequência e variação de peso quando houver).
Exemplos: aumentar carga onde houve estagnação, rever volume ou descanso onde houve queda, incentivar a frequência.
Não invente dados, não dê conselhos médicos nem de dieta específica. Cada sugestão com no máximo 200 caracteres.
Responda APENAS com um objeto JSON no formato {"<id>": ["sugestão", ...]}, usando os ids recebidos.`;

const TIMEOUT_MS = 25_000;

export type AiResult = { source: AiSource; ok: boolean; error?: string; suggestions: Record<string, string[]> };

/** Dados pseudonimizados: sem nome do aluno; peso só quando ele permite. */
function payload(students: ReportStudent[]) {
  const alias = new Map(students.map((s, i) => [`a${i + 1}`, s.id]));
  const data = students.map((s, i) => ({
    id: `a${i + 1}`,
    treinos_semana: s.sessions,
    treinos_semana_anterior: s.prevSessions,
    fichas: s.plans,
    treinos_livres: s.free,
    volume_kg: s.volume,
    volume_semana_anterior_kg: s.prevVolume,
    exercicios: s.exercises.map((e) => ({ nome: e.name, carga_kg: e.current, anterior_kg: e.previous, tendencia: e.trend })),
    recordes: s.prs,
    semanas_seguidas: s.streakWeeks,
    peso: s.weight.visible ? s.weight.change : "não compartilhado",
  }));
  return { alias, text: JSON.stringify(data) };
}

/** Extrai o JSON da resposta e volta para os ids reais dos alunos. */
function parse(text: string, alias: Map<string, string>): Record<string, string[]> {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const [a, list] of Object.entries(parsed)) {
    const id = alias.get(a);
    if (!id || !Array.isArray(list)) continue;
    const items = list.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 300));
    if (items.length) out[id] = items.slice(0, 4);
  }
  return out;
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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

/** Claude (Anthropic). Precisa de ANTHROPIC_API_KEY; modelo em ANTHROPIC_MODEL. */
async function claude(prompt: string): Promise<string> {
  const body = (await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    {
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    },
  )) as { content?: { type: string; text?: string }[] };
  return body.content?.find((c) => c.type === "text")?.text ?? "";
}

/** Gemini (Google AI Studio, tem faixa gratuita). Precisa de GEMINI_API_KEY; modelo em GEMINI_MODEL. */
async function gemini(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const body = (await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000, temperature: 0.4 },
    },
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

const PROVIDERS: { source: AiSource; enabled: () => boolean; call: (prompt: string) => Promise<string> }[] = [
  { source: "gemini", enabled: () => !!process.env.GEMINI_API_KEY, call: gemini },
  { source: "claude", enabled: () => !!process.env.ANTHROPIC_API_KEY, call: claude },
];

/**
 * Sugestões de todas as IAs configuradas, em paralelo (uma chamada por IA por Personal).
 * Cada IA que falhar volta com `ok: false` e o motivo; quem chama mantém as regras simples.
 */
export async function aiSuggestions(students: ReportStudent[]): Promise<AiResult[]> {
  if (!students.length) return [];
  const { alias, text } = payload(students);
  return Promise.all(
    PROVIDERS.filter((p) => p.enabled()).map(async ({ source, call }): Promise<AiResult> => {
      try {
        const suggestions = parse(await call(text), alias);
        if (!Object.keys(suggestions).length) return { source, ok: false, error: "resposta vazia ou fora do formato", suggestions };
        return { source, ok: true, suggestions };
      } catch (e) {
        const error = e instanceof Error ? (e.name === "AbortError" ? "tempo esgotado" : e.message) : "erro desconhecido";
        console.error(`IA do relatório (${source}) falhou:`, error);
        return { source, ok: false, error, suggestions: {} };
      }
    }),
  );
}
