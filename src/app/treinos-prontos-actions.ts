"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

/** Copia os 4 treinos prontos do nível: para as fichas da pessoa ou, no Personal, como modelos. */
export async function adoptStarter(fd: FormData) {
  const session = await getSessionProfile();
  if (!session) redirect("/entrar");
  const level = String(fd.get("level") ?? "");
  const asTemplates = fd.get("as_templates") === "1";
  const back = asTemplates ? "/personal/treinos-prontos" : "/aluno/treinos-prontos";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adopt_starter_workouts", { p_level: level, p_as_templates: asTemplates });
  if (error) redirect(`${back}?erro=${encodeURIComponent(friendlyError(error.message))}`);
  revalidatePath(asTemplates ? "/personal/modelos" : "/aluno");
  redirect(asTemplates ? `/personal/modelos?prontos=${data ?? 0}` : `/aluno?prontos=${data ?? 0}#fichas`);
}
