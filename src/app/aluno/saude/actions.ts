"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { MULTI_FIELDS, PARQ, SINGLE_FIELDS } from "@/lib/health";

/** Salva a anamnese do aluno logado (opções padronizadas; o banco valida os códigos). */
export async function saveHealthForm(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireStudent();
  const unanswered = PARQ.filter((q) => !fd.get(`parq_${q.value}`));
  if (unanswered.length) return { error: `Responda todas as perguntas do PAR-Q (faltam ${unanswered.length}).` };
  const p: Record<string, unknown> = {
    parq_yes: PARQ.filter((q) => fd.get(`parq_${q.value}`) === "sim").map((q) => q.value),
    notes: String(fd.get("notes") ?? ""),
    smoker: fd.get("smoker") === "sim" ? true : fd.get("smoker") === "nao" ? false : null,
  };
  for (const q of MULTI_FIELDS) p[q.key] = fd.getAll(q.key).map(String);
  for (const q of SINGLE_FIELDS) p[q.key] = String(fd.get(q.key) ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_health_form", { p: p as never });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/aluno");
  revalidatePath("/aluno/saude");
  return { ok: "Anamnese salva! Seu Personal já pode ver. 🩺" };
}

/** Anexa (ou remove) a liberação médica já enviada para a pasta do aluno no bucket "medical". */
export async function setClearance(path: string | null): Promise<ActionState> {
  await requireStudent();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_health_clearance", { p_path: path });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/aluno");
  revalidatePath("/aluno/saude");
  return { ok: path ? "Liberação médica enviada! 📄" : "Liberação removida." };
}
