"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

/** Conta já existente (aluno, ou admin no modo aluno) aceita o convite e passa a treinar com o Personal. */
export async function acceptInvite(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) redirect(`/convite/${encodeURIComponent(token)}?erro=${encodeURIComponent(friendlyError(error.message))}`);
  revalidatePath("/aluno", "layout");
  redirect("/aluno/personais?vinculado=1");
}
