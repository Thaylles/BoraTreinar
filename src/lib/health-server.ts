import "server-only";
import { createClient } from "@/lib/supabase/server";
import { cautionsFor, type HealthForm } from "@/lib/health";

/** Cuidados por grupo muscular a partir da anamnese do aluno (vazio para modelos ou sem anamnese). */
export async function loadCautions(studentId: string | null): Promise<Record<string, string[]>> {
  if (!studentId) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("health_forms").select("*").eq("student_id", studentId).maybeSingle();
  return cautionsFor(data as HealthForm | null);
}
