"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** Define ou troca a meta semanal de cardio (Personal vinculado, ou o próprio aluno sem Personal). */
export async function saveCardioGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  const studentId = String(fd.get("student_id") ?? "");
  const kind = String(fd.get("kind") ?? "");
  const target = num(fd.get("target"));
  const minSpeed = kind === "intenso" ? num(fd.get("min_speed")) : null;
  const minLevel = kind === "intenso" ? num(fd.get("min_level")) : null;
  if (!target || Number.isNaN(target) || target <= 0) return { error: "Informe a meta (um número maior que zero)." };
  if (Number.isNaN(minSpeed) || Number.isNaN(minLevel)) return { error: "Velocidade e nível precisam ser números." };
  if (kind === "intenso" && minSpeed == null && minLevel == null)
    return { error: "Diga a partir de qual velocidade (esteira) ou nível (bicicleta/elíptico) conta como ritmo forte." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_cardio_goal", {
    p_student: studentId,
    p_kind: kind,
    p_target: target,
    p_min_speed: minSpeed,
    p_min_level: minLevel == null ? null : Math.round(minLevel),
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/aluno");
  revalidatePath(`/personal/alunos/${studentId}`);
  return { ok: "Meta de cardio salva! 🏃" };
}

export async function removeCardioGoal(fd: FormData) {
  const studentId = String(fd.get("student_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("clear_cardio_goal", { p_student: studentId });
  revalidatePath("/aluno");
  revalidatePath(`/personal/alunos/${studentId}`);
}
