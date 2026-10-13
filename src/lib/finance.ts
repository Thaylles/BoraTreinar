/** Semanas por mês em média (52 / 12): base do valor por aula dos pacotes mensais. */
export const WEEKS_PER_MONTH = 52 / 12;

export type PackageKind = "por_aula" | "mensal";
export type PackageLike = { kind: PackageKind; price: number; classes_per_week: number | null };

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** 1234.5 → "R$ 1.234,50" */
export const brl = (n: number) => brlFmt.format(n).replace(/ /g, " ");

/** Valor de cada aula do pacote (mensal: preço ÷ aulas no mês). */
export function pricePerClass(p: PackageLike): number {
  if (p.kind === "por_aula" || !p.classes_per_week) return p.price;
  return p.price / (p.classes_per_week * WEEKS_PER_MONTH);
}

/** Aulas por mês em média de um pacote mensal (arredondado). */
export const classesPerMonth = (classesPerWeek: number) => Math.round(classesPerWeek * WEEKS_PER_MONTH);

/** Descrição curta do pacote: "2x por semana · R$ 350,00/mês". */
export function packageSummary(p: PackageLike): string {
  return p.kind === "por_aula" ? `${brl(p.price)} por aula` : `${p.classes_per_week}x por semana · ${brl(p.price)}/mês`;
}

export type PaymentStatus = "pago" | "atrasado" | "hoje" | "pendente";
export function paymentStatus(p: { paid_at: string | null; due_on: string; amount: number }, today: string): PaymentStatus {
  if (p.paid_at || p.amount === 0) return "pago";
  if (p.due_on < today) return "atrasado";
  if (p.due_on === today) return "hoje";
  return "pendente";
}

/** Converte "350", "350,50" ou "1.200,00" em número (null se inválido). */
export function parseMoney(v: unknown): number | null {
  const s = String(v ?? "").trim().replace(/^R\$\s*/, "");
  if (!s) return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Pacotes sugeridos para começar (o Personal edita depois). */
export const SUGGESTED_PACKAGES: { name: string; kind: PackageKind; classes_per_week: number | null; price: number }[] = [
  { name: "Diária", kind: "por_aula", classes_per_week: null, price: 50 },
  { name: "1x por semana", kind: "mensal", classes_per_week: 1, price: 200 },
  { name: "2x por semana", kind: "mensal", classes_per_week: 2, price: 350 },
  { name: "3x por semana", kind: "mensal", classes_per_week: 3, price: 480 },
];
