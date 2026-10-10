import type { Tables } from "@/lib/database.types";
import type { EditorItem } from "@/components/plans/plan-editor";
import type { CatalogItem } from "@/components/plans/exercise-picker";

export type PlanItem = Tables<"workout_plan_items">;

/** "10" | "8-12" | "" → {min, max}. Aceita "8 a 12", "8–12". */
export function parseReps(input: string): { reps_min: number | null; reps_max: number | null } | null {
  const s = input.trim();
  if (!s) return { reps_min: null, reps_max: null };
  const m = s.match(/^(\d{1,3})\s*(?:[-–—]|a|até)\s*(\d{1,3})$/i);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a <= b ? { reps_min: a, reps_max: b } : null;
  }
  if (/^\d{1,3}$/.test(s)) return { reps_min: Number(s), reps_max: null };
  return null;
}

export function formatReps(min: number | null, max: number | null): string {
  if (min == null && max == null) return "";
  if (max == null || max === min) return String(min ?? max);
  return `${min ?? 0}–${max}`;
}

export function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}min${String(s).padStart(2, "0")}` : `${m}min`;
}

export const formatKg = (n: number | null | undefined) =>
  n == null ? "" : `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

/** Converte itens do banco para o formato do editor. */
export function toEditorItems(
  rows: { sets: number; reps_min: number | null; reps_max: number | null; suggested_load: number | null; rest_seconds: number; notes: string | null; equipment: CatalogItem | null }[],
): Omit<EditorItem, "key">[] {
  return rows
    .filter((r) => r.equipment)
    .map((r) => ({
      equipment: r.equipment!,
      sets: r.sets,
      reps: formatReps(r.reps_min, r.reps_max),
      load: r.suggested_load == null ? "" : String(r.suggested_load).replace(".", ","),
      rest: r.rest_seconds,
      notes: r.notes ?? "",
    }));
}
