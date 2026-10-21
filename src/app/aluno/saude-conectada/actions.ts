"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
import { hashAppToken, newAppToken } from "@/lib/health-connect/server";
import { syncIntentUrl } from "@/lib/health-connect/shared";

/** Cria o token do app Android e devolve o link que abre a sincronização no celular. */
export async function connectHealthApp(): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const token = newAppToken();
  const { error } = await supabase.from("app_tokens").insert({ token_hash: hashAppToken(token), label: "App Android" });
  if (error) return { error: "Não foi possível conectar. Você já tem 5 aparelhos? Desconecte algum e tente de novo." };
  revalidatePath("/aluno/saude-conectada");
  return { url: syncIntentUrl(appUrl, token) };
}

/** Desconecta todos os aparelhos (o app precisa ser conectado de novo pelo site). */
export async function disconnectHealthApps() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("app_tokens").delete().eq("user_id", user.id);
  revalidatePath("/aluno/saude-conectada");
}
