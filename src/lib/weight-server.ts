import "server-only";
import { createClient } from "@/lib/supabase/server";

export type WeighInStatus = {
  frequency: "semanal" | "quinzenal";
  lastMeasuredOn: string | null;
  dueOn: string | null;
  overdue: boolean;
};

/** Situação da pesagem (sem o valor do peso). */
export async function getWeighInStatus(studentId: string): Promise<WeighInStatus> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("weigh_in_status", { p_student: studentId });
  const row = data?.[0];
  return {
    frequency: row?.frequency ?? "semanal",
    lastMeasuredOn: row?.last_measured_on ?? null,
    dueOn: row?.due_on ?? null,
    overdue: row?.overdue ?? true,
  };
}

/** Pesagens visíveis para o usuário logado (o RLS esconde do Personal sem permissão). */
export async function listWeights(studentId: string, limit = 60) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("body_weights")
    .select("id, weight_kg, measured_on")
    .eq("student_id", studentId)
    .order("measured_on", { ascending: false })
    .limit(limit);
  return (data ?? []).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) }));
}

export async function getStudentSettings(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_settings")
    .select("weight_visible_to_personal, weigh_in_frequency")
    .eq("student_id", studentId)
    .maybeSingle();
  return {
    weightVisible: data?.weight_visible_to_personal ?? false,
    frequency: data?.weigh_in_frequency ?? ("semanal" as const),
  };
}

/** "dd/mm" a partir de "YYYY-MM-DD" (data civil, sem fuso). */
export const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
