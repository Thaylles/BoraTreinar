/** Meta de água: tamanhos de garrafa e formatação (funções puras). */

/** Garrafas para registrar com um toque (ml). */
export const BOTTLES = [500, 1000, 1500, 2000] as const;

export const WATER_MIN_ML = 500;
export const WATER_MAX_ML = 8000;

/** "500 ml", "1 L", "1,5 L". */
export function bottleLabel(ml: number): string {
  return ml < 1000 ? `${ml} ml` : `${(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
}

/** "1,2 L" (sempre em litros, 1 casa). */
export function liters(ml: number): string {
  return `${(ml / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
}

/** Meta sugerida: 35 ml por kg, arredondada a 250 ml (entre 1,5 e 5 L). Sem peso: 2 L. */
export function suggestedGoal(weightKg: number | null | undefined): number {
  if (!weightKg || weightKg <= 0) return 2000;
  return Math.min(5000, Math.max(1500, Math.round((weightKg * 35) / 250) * 250));
}

/** Converte o que a pessoa digitou ("2,5", "2.5", "2500") em ml; null se fora de 0,5–8 L. */
export function parseGoal(input: string): number | null {
  const n = Number(input.replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  const ml = Math.round(n < 20 ? n * 1000 : n);
  return ml >= WATER_MIN_ML && ml <= WATER_MAX_ML ? ml : null;
}
