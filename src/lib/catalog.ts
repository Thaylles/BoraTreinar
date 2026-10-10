import type { Enums, Tables } from "@/lib/database.types";

export type MuscleGroup = Enums<"muscle_group">;
export type Equipment = Tables<"equipment">;

/** Ordem de exibição e rótulos em pt-BR. */
export const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: "peito", label: "Peito" },
  { value: "costas", label: "Costas" },
  { value: "ombros", label: "Ombros" },
  { value: "biceps", label: "Bíceps" },
  { value: "triceps", label: "Tríceps" },
  { value: "antebraco", label: "Antebraço" },
  { value: "quadriceps", label: "Quadríceps" },
  { value: "posterior", label: "Posterior de coxa" },
  { value: "gluteos", label: "Glúteos" },
  { value: "adutores", label: "Adutores" },
  { value: "panturrilha", label: "Panturrilha" },
  { value: "abdomen", label: "Abdômen" },
  { value: "cardio", label: "Cardio" },
  { value: "corpo_inteiro", label: "Corpo inteiro" },
];

export const groupLabel = (g: MuscleGroup) =>
  MUSCLE_GROUPS.find((m) => m.value === g)?.label ?? g;

export const isMuscleGroup = (v: unknown): v is MuscleGroup =>
  MUSCLE_GROUPS.some((m) => m.value === v);

export const EQUIPMENT_BUCKET = "equipment";

/** URL da imagem: upload do Personal (Storage) > imagem estática do catálogo > null (placeholder). */
export function equipmentImageSrc(e: Pick<Equipment, "image_path" | "image_url">): string | null {
  if (e.image_path) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${EQUIPMENT_BUCKET}/${e.image_path}`;
  }
  return e.image_url;
}
