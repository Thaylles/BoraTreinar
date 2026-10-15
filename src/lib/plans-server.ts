import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CatalogItem } from "@/components/plans/exercise-picker";

const CATALOG_COLS = "id, name, muscle_group, image_path, image_url, is_bodyweight, is_default, created_by";

/**
 * Exercícios que podem entrar numa ficha. Para ficha de aluno, só os que o aluno
 * consegue ver (padrão ou criados por Personais vinculados a ele).
 */
export async function loadCatalogFor(studentId: string | null): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const [{ data: all }, links] = await Promise.all([
    supabase.from("equipment").select(CATALOG_COLS).order("name"),
    studentId
      ? supabase.from("personal_students").select("personal_id").eq("student_id", studentId).eq("status", "ativo")
      : Promise.resolve({ data: null }),
  ]);
  const allowed = links.data ? new Set(links.data.map((l) => l.personal_id)) : null;
  return (all ?? [])
    .filter((e) => !allowed || e.is_default || (e.created_by && (allowed.has(e.created_by) || e.created_by === studentId)))
    .map(({ id, name, muscle_group, image_path, image_url, is_bodyweight }) => ({
      id, name, muscle_group, image_path, image_url, is_bodyweight,
    }));
}

export async function loadPlan(planId: string) {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select(
      "*, creator:profiles!workout_plans_created_by_fkey(full_name), student:profiles!workout_plans_student_id_fkey(id, full_name)",
    )
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return null;
  const { data: items } = await supabase
    .from("workout_plan_items")
    .select("*, equipment:equipment(id, name, muscle_group, image_path, image_url, is_bodyweight, description)")
    .eq("plan_id", planId)
    .order("position");
  return { plan, items: items ?? [] };
}

export type LoadedPlan = NonNullable<Awaited<ReturnType<typeof loadPlan>>>;
