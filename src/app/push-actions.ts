"use server";

import { createClient } from "@/lib/supabase/server";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Guarda a inscrição de push deste aparelho para a pessoa logada. */
export async function savePushSubscription(sub: Sub, userAgent: string): Promise<{ error?: string }> {
  if (!/^https:\/\//.test(sub?.endpoint ?? "") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Inscrição inválida." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  // O mesmo aparelho pode ter sido usado por outra conta: a inscrição passa a ser desta.
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: userAgent.slice(0, 300) || null,
  });
  return error ? { error: "Não foi possível ativar as notificações." } : {};
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
