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

export type Technique = NonNullable<PlanItem["technique"]>;

/** Técnicas avançadas por exercício. Bi-set e tri-set agrupam com o(s) exercício(s) seguinte(s). */
export const TECHNIQUES: { value: Technique; label: string; hint: string; groupSize?: number }[] = [
  { value: "biset", label: "Bi-set", hint: "Junto com o próximo exercício, sem descanso entre eles", groupSize: 2 },
  { value: "triset", label: "Tri-set", hint: "Junto com os 2 próximos exercícios, sem descanso entre eles", groupSize: 3 },
  { value: "dropset", label: "Drop-set", hint: "Na última série, reduza a carga e continue até a falha" },
  { value: "restpause", label: "Rest-pause", hint: "Na falha, pausa de 10–15 s e mais algumas repetições" },
  { value: "piramide", label: "Pirâmide", hint: "Aumente a carga e diminua as repetições a cada série" },
];

export const techniqueInfo = (t: Technique | null | undefined) => (t ? TECHNIQUES.find((x) => x.value === t) : undefined);
export const isTechnique = (v: unknown): v is Technique => TECHNIQUES.some((t) => t.value === v);

/**
 * Para cada posição, quantos exercícios seguintes ainda fazem parte do mesmo bi-set/tri-set.
 * Ex.: [biset, normal, normal] → [1, 0, 0]: o 1º não descansa antes do 2º.
 */
export function groupedWithNext(techniques: (Technique | null | undefined)[]): number[] {
  const out = techniques.map(() => 0);
  for (let i = 0; i < techniques.length; i++) {
    const size = techniqueInfo(techniques[i])?.groupSize;
    if (!size) continue;
    for (let k = 0; k < size - 1 && i + k < techniques.length - 1; k++) out[i + k] = size - 1 - k;
  }
  return out.map((n, i) => Math.min(n, techniques.length - 1 - i));
}

/** Converte itens do banco para o formato do editor. */
export function toEditorItems(
  rows: {
    sets: number;
    reps_min: number | null;
    reps_max: number | null;
    suggested_load: number | null;
    rest_seconds: number;
    notes: string | null;
    technique?: Technique | null;
    equipment: CatalogItem | null;
    substitute?: CatalogItem | null;
  }[],
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
      technique: r.technique ?? "",
      substitute: r.substitute ?? null,
    }));
}
