/** Troca de exercício quando o aparelho está ocupado (funções puras). */

type Item = { id: string; name: string; muscle_group: string };

const STOP = new Set(["com", "de", "do", "da", "na", "no", "em", "e", "a", "o"]);
const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/**
 * Candidatos do mesmo grupo muscular para trocar `target`, do mais parecido para o menos:
 * prioriza o que o aluno já fez (tem histórico) e nomes com palavras em comum.
 */
export function rankAlternatives<T extends Item>(
  target: Item,
  catalog: T[],
  opts: { exclude?: Set<string>; known?: Set<string>; limit?: number } = {},
): T[] {
  const tw = new Set(words(target.name));
  return catalog
    .filter((c) => c.id !== target.id && c.muscle_group === target.muscle_group && !opts.exclude?.has(c.id))
    .map((c) => ({ c, score: (opts.known?.has(c.id) ? 2 : 0) + words(c.name).filter((w) => tw.has(w)).length }))
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name, "pt-BR"))
    .slice(0, opts.limit ?? 6)
    .map((x) => x.c);
}

export const SWAP_SYSTEM = `Você é um treinador de musculação experiente. O aparelho de um exercício está ocupado na academia.
Escolha, entre os candidatos recebidos, de 1 a 2 exercícios que melhor substituem o original:
mesmo grupo muscular, padrão de movimento parecido e estímulo semelhante. Respeite os cuidados de saúde informados.
Use APENAS ids da lista de candidatos. Responda só com JSON: {"ids": ["id1", "id2"], "motivo": "frase curta em português"}.`;

export function swapPrompt(original: Item, candidates: Item[], cautions: string[]): string {
  return JSON.stringify({
    exercicio_original: { nome: original.name, grupo: original.muscle_group },
    cuidados_de_saude: cautions,
    candidatos: candidates.map((c) => ({ id: c.id, nome: c.name })),
  });
}

/** Lê a resposta da IA: só ids que estão entre os candidatos, no máximo 2. */
export function parseSwap(raw: unknown, candidateIds: string[]): { ids: string[]; reason: string | null } {
  const r = (raw ?? {}) as { ids?: unknown; motivo?: unknown };
  const ids = (Array.isArray(r.ids) ? r.ids : []).filter((x): x is string => typeof x === "string" && candidateIds.includes(x));
  return { ids: [...new Set(ids)].slice(0, 2), reason: typeof r.motivo === "string" ? r.motivo.slice(0, 200) : null };
}
