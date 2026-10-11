"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";

/** LGPD: exclui a conta do aluno e todos os dados dele (irreversível). */
export async function deleteMyAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("aluno");
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "EXCLUIR") {
    return { error: 'Digite EXCLUIR para confirmar.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: friendlyError(error.message) };
  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}
