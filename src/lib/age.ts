/** Idade (anos completos) na data `today` (YYYY-MM-DD). */
export function ageOn(birth: string, today: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Erro da data de nascimento (YYYY-MM-DD) ou null se ok: idade entre 16 e 100 anos. */
export function birthDateError(birth: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || Number.isNaN(Date.parse(birth))) return "Data de nascimento inválida.";
  const age = ageOn(birth, today);
  if (age < 16 || age > 100) return "Confira a data de nascimento (idade entre 16 e 100 anos).";
  return null;
}
