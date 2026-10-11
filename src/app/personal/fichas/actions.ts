"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export type PlanPayload = {
  planId: string | null;
  studentId: string | null;
  name: string;
  goal: string;
  notes: string;
  validUntil: string;
  items: {
    equipment_id: string;
    sets: number;
    reps_min: number | null;
    reps_max: number | null;
    suggested_load: number | null;
    rest_seconds: number;
    notes: string;
  }[];
};

export async function savePlan(p: PlanPayload): Promise<{ error: string } | void> {
  if (!p.name.trim()) return { error: "Dê um nome para a ficha (ex.: Treino A)." };
  if (!p.items.length) return { error: "Adicione pelo menos um exercício." };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_workout_plan", {
    p_plan: p.planId,
    p_student: p.planId ? null : p.studentId,
    p_name: p.name,
    p_goal: p.goal || null,
    p_notes: p.notes || null,
    p_valid_until: p.validUntil || null,
    p_items: p.items,
  });
  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/personal", "layout");
  redirect(`/personal/fichas/${id}?salvo=1`);
}

/** destino: "este" | "modelo" | <id do aluno> */
export async function duplicatePlan(fd: FormData) {
  const planId = String(fd.get("plan_id"));
  const target = String(fd.get("target") ?? "");
  const currentStudent = String(fd.get("student_id") ?? "") || null;
  const studentId = target === "modelo" ? null : target === "este" ? currentStudent : target;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("duplicate_workout_plan", {
    p_plan: planId,
    p_student: studentId,
    p_name: String(fd.get("name") ?? "") || null,
  });
  if (error) redirect(`/personal/fichas/${planId}?erro=${encodeURIComponent(friendlyError(error.message))}`);
  revalidatePath("/personal", "layout");
  redirect(`/personal/fichas/${id}?duplicada=1`);
}

/** Aplica um modelo a um aluno e abre a ficha nova para ajustes. */
export async function applyTemplate(fd: FormData) {
  const studentId = String(fd.get("student_id"));
  const templateId = String(fd.get("template_id"));
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("duplicate_workout_plan", {
    p_plan: templateId,
    p_student: studentId,
  });
  if (error) redirect(`/personal/alunos/${studentId}?erro=${encodeURIComponent(friendlyError(error.message))}`);
  revalidatePath(`/personal/alunos/${studentId}`);
  redirect(`/personal/fichas/${id}/editar`);
}

export async function archivePlan(fd: FormData) {
  const planId = String(fd.get("plan_id"));
  const supabase = await createClient();
  await supabase.rpc("set_workout_plan_archived", {
    p_plan: planId,
    p_archived: fd.get("archived") === "1",
  });
  revalidatePath("/personal", "layout");
  redirect(`/personal/fichas/${planId}`);
}

export async function deletePlan(fd: FormData) {
  const planId = String(fd.get("plan_id"));
  const back = String(fd.get("back") ?? "/personal");
  const supabase = await createClient();
  const { error } = await supabase.from("workout_plans").delete().eq("id", planId);
  if (error) redirect(`/personal/fichas/${planId}?erro=${encodeURIComponent(friendlyError(error.message))}`);
  revalidatePath("/personal", "layout");
  redirect(back.startsWith("/") ? back : "/personal");
}
