/** Sugestão de progressão de carga a partir da última execução do exercício. */

export type ProgressionInput = {
  /** Séries feitas na última vez (só as marcadas como feitas). */
  lastSets: { load: number; reps: number }[] | null;
  targetSets: number;
  repsMin: number | null;
  repsMax: number | null;
  cardio?: boolean;
};

export type Progression = { from: number; to: number; step: number };

/** Incremento usual: pequeno para cargas leves, maior para cargas pesadas. */
export function loadStep(load: number): number {
  if (load < 10) return 1;
  if (load < 40) return 2;
  if (load < 100) return 2.5;
  return 5;
}

/**
 * Sugere subir a carga quando, na última vez, o aluno fez todas as séries previstas
 * com a mesma carga (a maior) e bateu o topo da faixa de repetições em todas.
 * Sem faixa definida na ficha, usa 12 repetições como referência.
 */
export function suggestProgression(p: ProgressionInput): Progression | null {
  if (p.cardio || !p.lastSets?.length) return null;
  const from = Math.max(...p.lastSets.map((s) => s.load));
  if (!(from > 0)) return null;
  const atTop = p.lastSets.filter((s) => s.load === from);
  if (atTop.length < Math.max(1, p.targetSets)) return null;
  const goal = p.repsMax ?? p.repsMin ?? 12;
  if (!atTop.every((s) => s.reps >= goal)) return null;
  const step = loadStep(from);
  return { from, to: Math.round((from + step) * 2) / 2, step };
}
