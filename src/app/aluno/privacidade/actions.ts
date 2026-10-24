"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";

/** LGPD: exclui a conta do aluno e todos os dados dele (irreversível). */
export async function deleteMyAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStudent();
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "EXCLUIR") {
    return { error: 'Digite EXCLUIR para confirmar.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: friendlyError(error.message) };
  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}

/** Libera (ou não) o Personal para editar as fichas que o próprio aluno montou. */
export async function setPersonalEditsPlans(fd: FormData) {
  const { profile } = await requireStudent();
  const allow = fd.get("allow") === "1";
  const supabase = await createClient();
  const { data: updated } = await supabase
    .from("student_settings")
    .update({ personal_edits_plans: allow })
    .eq("student_id", profile.id)
    .select("student_id");
  if (!updated?.length) await supabase.from("student_settings").insert({ student_id: profile.id, personal_edits_plans: allow });
  revalidatePath("/aluno", "layout");
}

/** Liga/desliga o lembrete do dia de treino (push 1h antes da aula ou do horário de costume). */
export async function setTrainingReminders(fd: FormData) {
  const { profile } = await requireStudent();
  const on = fd.get("on") === "1";
  const supabase = await createClient();
  const { data: updated } = await supabase
    .from("student_settings")
    .update({ training_reminders: on })
    .eq("student_id", profile.id)
    .select("student_id");
  if (!updated?.length) await supabase.from("student_settings").insert({ student_id: profile.id, training_reminders: on });
  revalidatePath("/aluno", "layout");
}
