/** Cardio: tempo, distância e intensidade do painel do aparelho, e a meta semanal. */

export type IntensityUnit = "velocidade" | "nivel";
export type CardioGoalKind = "minutos" | "distancia" | "intenso";

export type CardioSet = {
  minutes: number | null;
  km: number | null;
  speed: number | null;
  incline: number | null;
  level: number | null;
};

export type CardioGoal = {
  kind: CardioGoalKind;
  target: number;
  min_speed_kmh: number | null;
  min_level: number | null;
  by_personal: boolean;
};

export type CardioWeek = {
  week_start: string;
  minutes: number;
  km: number;
  intense_minutes: number;
  days: number;
  goal: CardioGoal | null;
};

const num = (n: number, digits = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

/** "30 min · 4,5 km · 9 km/h · inclinação 1%" (só o que foi preenchido). */
export function cardioSetLine(s: CardioSet): string {
  const parts: string[] = [];
  if (s.minutes != null) parts.push(`${num(s.minutes)} min`);
  if (s.km != null) parts.push(`${num(s.km, 2)} km`);
  if (s.speed != null) parts.push(`${num(s.speed)} km/h`);
  if (s.incline != null && s.incline > 0) parts.push(`inclinação ${num(s.incline)}%`);
  if (s.level != null) parts.push(`nível ${s.level}`);
  return parts.join(" · ") || "sem dados";
}

export const GOAL_KIND_LABEL: Record<CardioGoalKind, string> = {
  minutos: "Tempo por semana",
  distancia: "Distância por semana",
  intenso: "Minutos em ritmo forte",
};

/** Texto da meta ("150 min por semana", "12 km por semana", "60 min em ritmo forte (≥ 8,5 km/h ou nível 5)"). */
export function goalLabel(g: Pick<CardioGoal, "kind" | "target" | "min_speed_kmh" | "min_level">): string {
  if (g.kind === "distancia") return `${num(g.target)} km por semana`;
  if (g.kind === "minutos") return `${num(g.target)} min por semana`;
  const limits = [g.min_speed_kmh != null && `≥ ${num(g.min_speed_kmh)} km/h`, g.min_level != null && `nível ≥ ${g.min_level}`].filter(Boolean);
  return `${num(g.target)} min em ritmo forte por semana${limits.length ? ` (${limits.join(" ou ")})` : ""}`;
}

/** Quanto da meta foi cumprido na semana. */
export function goalProgress(w: CardioWeek): { value: number; target: number; unit: string; pct: number; done: boolean } | null {
  if (!w.goal) return null;
  const value = w.goal.kind === "distancia" ? w.km : w.goal.kind === "intenso" ? w.intense_minutes : w.minutes;
  const target = Number(w.goal.target);
  const pct = Math.min(100, Math.round((value / Math.max(target, 0.1)) * 100));
  return { value, target, unit: w.goal.kind === "distancia" ? "km" : "min", pct, done: value >= target };
}

export const formatAmount = (n: number, unit: string) => `${num(n, unit === "km" ? 2 : 1)} ${unit}`;

/** Normaliza o JSON de `cardio_week` (números podem vir como string). */
export function parseCardioWeek(raw: unknown): CardioWeek {
  const r = (raw ?? {}) as Record<string, unknown>;
  const g = r.goal as Record<string, unknown> | null | undefined;
  const n = (x: unknown) => (x == null ? 0 : Number(x));
  const opt = (x: unknown) => (x == null ? null : Number(x));
  return {
    week_start: String(r.week_start ?? ""),
    minutes: n(r.minutes),
    km: n(r.km),
    intense_minutes: n(r.intense_minutes),
    days: n(r.days),
    goal: g
      ? {
          kind: g.kind as CardioGoalKind,
          target: n(g.target),
          min_speed_kmh: opt(g.min_speed_kmh),
          min_level: opt(g.min_level),
          by_personal: Boolean(g.by_personal),
        }
      : null,
  };
}
