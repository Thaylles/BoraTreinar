/** Calculadora de anilhas e séries de aquecimento (funções puras). */

/** Anilhas padrão da academia (kg), da maior para a menor. */
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
/** Barras para escolher na calculadora (0 = sem barra: máquina, halter, polia). */
export const BARS = [20, 15, 10, 0];
export const DEFAULT_BAR = 20;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Anilhas de CADA lado da barra para chegar à carga total (método guloso, da maior para a menor).
 * `remainder` é o que sobra por não existir anilha pequena o bastante (0 quando fecha certinho).
 */
export function platesFor(total: number, bar = DEFAULT_BAR, plates = DEFAULT_PLATES): { perSide: number[]; remainder: number } {
  let side = round2((total - bar) / 2);
  if (!Number.isFinite(side) || side <= 0) return { perSide: [], remainder: Math.max(0, round2(total - bar)) };
  const perSide: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side = round2(side - p);
    }
  }
  return { perSide, remainder: round2(side * 2) };
}

/** "2×20 + 10" a partir da lista de anilhas de um lado. */
export function platesLabel(perSide: number[]): string {
  const counts = new Map<number, number>();
  for (const p of perSide) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts]
    .map(([p, n]) => `${n > 1 ? `${n}×` : ""}${p.toLocaleString("pt-BR")}`)
    .join(" + ");
}

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

/** Barra provável pelo nome do exercício (o aluno pode trocar na calculadora). */
export function guessBar(name: string): number {
  return /\bbarra\b|levantamento terra|agachamento livre|stiff|remada curvada|desenvolvimento militar/i.test(name) && !/barra fixa/i.test(name)
    ? DEFAULT_BAR
    : 0;
}
