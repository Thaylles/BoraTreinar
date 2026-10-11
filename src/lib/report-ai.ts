import "server-only";
import type { ReportStudent } from "@/lib/report";

const API = "https://api.anthropic.com/v1/messages";

const SYSTEM = `Você é um treinador de musculação experiente ajudando um Personal Trainer brasileiro.
Para cada aluno, escreva de 2 a 4 sugestões curtas e práticas de estratégia para a próxima semana, em português do Brasil,
com base nos dados da semana (frequência, cargas que aumentaram/mantiveram/diminuíram, recordes, sequência e variação de peso quando houver).
Exemplos: aumentar carga onde houve estagnação, rever volume ou descanso onde houve queda, incentivar a frequência.
Não invente dados, não dê conselhos médicos nem de dieta específica. Cada sugestão com no máximo 200 caracteres.
Responda APENAS com um objeto JSON no formato {"<id>": ["sugestão", ...]}, usando os ids recebidos.`;

/**
 * Sugestões por IA (Anthropic) para os alunos de um Personal, numa única chamada.
 * Os dados vão pseudonimizados (sem nome; peso só quando o aluno permite).
 * Retorna null sem chave ou em qualquer falha; quem chama usa as regras simples.
 */
export async function aiSuggestions(students: ReportStudent[]): Promise<Record<string, string[]> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !students.length) return null;
  const alias = new Map(students.map((s, i) => [`a${i + 1}`, s.id]));
  const payload = students.map((s, i) => ({
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(API, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      }),
    });
    if (!res.ok) {
      console.error("IA do relatório falhou:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === "text")?.text ?? "";
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, string[]> = {};
    for (const [a, list] of Object.entries(parsed)) {
      const id = alias.get(a);
      if (!id || !Array.isArray(list)) continue;
      const items = list.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 300));
      if (items.length) out[id] = items.slice(0, 4);
    }
    return Object.keys(out).length ? out : null;
  } catch (e) {
    console.error("IA do relatório indisponível:", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
