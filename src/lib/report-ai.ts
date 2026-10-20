import "server-only";
import type { AiSource, ReportStudent } from "@/lib/report";
import { AI_PROVIDERS } from "@/lib/ai";

const SYSTEM = `Você é um treinador de musculação experiente ajudando um Personal Trainer brasileiro.
Para cada aluno, escreva de 3 a 5 sugestões curtas e práticas de estratégia para a próxima semana, em português do Brasil,
com base nos dados da semana: frequência e meta semanal, exercícios que deixou de fazer ou não completou, cardio (feito ou não,
tempo, distância, intensidade e meta de cardio), cargas que aumentaram/mantiveram/diminuíram, recordes, esforço e relatos de dor,
sequência de semanas e variação de peso quando houver.
Exemplos: investigar por que pulou exercícios e propor variações, ajustar o cardio para bater a meta, aumentar carga onde houve
estagnação, rever volume ou descanso onde houve queda, cuidar da recuperação quando o esforço está alto, incentivar a frequência.
Escreva também uma mensagem de motivação curta e calorosa (até 280 caracteres) que o Personal possa mandar direto para o aluno,
falando com ele em segunda pessoa, citando algo concreto da semana. Sem nome do aluno (use "você").
Não invente dados, não dê conselhos médicos nem de dieta específica. Cada sugestão com no máximo 200 caracteres.
Responda APENAS com um objeto JSON no formato {"<id>": {"sugestoes": ["sugestão", ...], "motivacao": "mensagem"}}, usando os ids recebidos.`;

const TIMEOUT_MS = 25_000;

export type AiResult = {
  source: AiSource;
  ok: boolean;
  error?: string;
  suggestions: Record<string, string[]>;
  /** Mensagem de motivação por aluno. */
  motivation: Record<string, string>;
};

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
    ...(s.detail && {
      dias_treinados: s.detail.days,
      meta_semanal_dias: s.detail.weeklyGoal,
      minutos_de_treino: s.detail.minutes,
      deixou_de_fazer: s.detail.missed.map((m) => ({
        exercicio: m.name,
        tipo: m.kind === "pulado" ? "não fez" : "séries não feitas",
        vezes_ou_series: m.count,
        ...(m.total != null && { series_total: m.total }),
      })),
      cardio: {
        fez: s.detail.cardio.minutes > 0,
        minutos: s.detail.cardio.minutes,
        km: s.detail.cardio.km,
        minutos_ritmo_forte: s.detail.cardio.intenseMinutes,
        dias: s.detail.cardio.days,
        sessoes: s.detail.cardio.items.map((i) => `${i.name}: ${i.line}`),
        meta: s.detail.cardio.goal && {
          descricao: s.detail.cardio.goal.label,
          feito: s.detail.cardio.goal.value,
          alvo: s.detail.cardio.goal.target,
          percentual: s.detail.cardio.goal.pct,
        },
      },
      esforco_medio_1a5: s.detail.effort.avg,
      treinos_com_dor: s.detail.effort.pain,
      comentarios_do_aluno: s.detail.effort.feedback,
      ultimo_treino: s.detail.lastWorkout,
      conquistas_da_semana: s.detail.achievements.map((a) => a.title),
    }),
  }));
  return { alias, text: JSON.stringify(data) };
}

/** Extrai o JSON da resposta e volta para os ids reais dos alunos. Aceita lista simples ou {sugestoes, motivacao}. */
function parse(text: string, alias: Map<string, string>): { suggestions: Record<string, string[]>; motivation: Record<string, string> } {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const suggestions: Record<string, string[]> = {};
  const motivation: Record<string, string> = {};
  for (const [a, value] of Object.entries(parsed)) {
    const id = alias.get(a);
    if (!id || !value) continue;
    const obj = Array.isArray(value) ? { sugestoes: value } : (value as { sugestoes?: unknown; motivacao?: unknown });
    const list = Array.isArray(obj.sugestoes) ? obj.sugestoes : [];
    const items = list.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 300));
    if (items.length) suggestions[id] = items.slice(0, 5);
    if (typeof obj.motivacao === "string" && obj.motivacao.trim()) motivation[id] = obj.motivacao.trim().slice(0, 400);
  }
  return { suggestions, motivation };
}

const PROVIDERS = AI_PROVIDERS.map((p) => ({
  ...p,
  call: (prompt: string) => p.call(SYSTEM, prompt, { maxTokens: 6000, timeoutMs: TIMEOUT_MS, json: true }),
}));

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
        const { suggestions, motivation } = parse(await call(text), alias);
        if (!Object.keys(suggestions).length) return { source, ok: false, error: "resposta vazia ou fora do formato", suggestions, motivation };
        return { source, ok: true, suggestions, motivation };
      } catch (e) {
        const error = e instanceof Error ? (e.name === "AbortError" ? "tempo esgotado" : e.message) : "erro desconhecido";
        console.error(`IA do relatório (${source}) falhou:`, error);
        return { source, ok: false, error, suggestions: {}, motivation: {} };
      }
    }),
  );
}
