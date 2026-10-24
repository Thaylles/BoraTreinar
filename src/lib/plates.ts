/** Séries de aquecimento (funções puras). */

export const DEFAULT_BAR = 20;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Arredonda para o múltiplo de `step` mais próximo (padrão 2,5 kg: um par das menores anilhas). */
export const roundTo = (n: number, step = 2.5) => round2(Math.round(n / step) * step);

export type WarmupSet = { load: number; reps: number };

/**
 * Até 2 séries de aquecimento antes da carga de trabalho:
 * cargas leves (< 40 kg) → 1 série com ~50% × 10; a partir de 40 kg → ~50% × 8 e ~75% × 4.
 * Nunca abaixo da barra (quando há barra) e sem repetir a carga de trabalho.
 */
export function warmupSets(workLoad: number, bar = 0): WarmupSet[] {
  if (!Number.isFinite(workLoad) || workLoad <= 0) return [];
  const step = workLoad < 10 ? 1 : 2.5;
  const plan: [number, number][] = workLoad < 40 ? [[0.5, 10]] : [[0.5, 8], [0.75, 4]];
  const out: WarmupSet[] = [];
  for (const [pct, reps] of plan) {
    const load = Math.max(bar, roundTo(workLoad * pct, step));
    if (load >= workLoad || out.some((s) => s.load === load)) continue;
    out.push({ load, reps });
  }
  return out;
}

/** Barra provável pelo nome do exercício (o aquecimento nunca fica abaixo dela). */
export function guessBar(name: string): number {
  return /\bbarra\b|levantamento terra|agachamento livre|stiff|remada curvada|desenvolvimento militar/i.test(name) && !/barra fixa/i.test(name)
    ? DEFAULT_BAR
    : 0;
}
