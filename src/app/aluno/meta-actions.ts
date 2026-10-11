"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Define (1–7) ou remove (0) a meta de dias de treino por semana do aluno. */
export async function setWeeklyGoal(fd: FormData) {
  const goal = Number(fd.get("goal"));
  if (!Number.isInteger(goal) || goal < 0 || goal > 7) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const weekly_goal = goal || null;
  const { data: updated } = await supabase.from("student_settings").update({ weekly_goal }).eq("student_id", user.id).select("student_id");
  if (!updated?.length) await supabase.from("student_settings").insert({ student_id: user.id, weekly_goal });
  revalidatePath("/aluno");
}
