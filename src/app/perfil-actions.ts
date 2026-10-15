"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { AVATAR_BUCKET } from "@/lib/avatar";

/** Troca (ou remove, com null) a foto de perfil e apaga o arquivo antigo. */
export async function setAvatar(path: string | null): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  if (path !== null && !path.startsWith(`${user.id}/`)) return { error: "Foto inválida." };
  const { data: current } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) return { error: friendlyError(error.message) };
  if (current?.avatar_path && current.avatar_path !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([current.avatar_path]);
  }
  revalidatePath("/", "layout");
  return { ok: path ? "Foto atualizada! 📸" : "Foto removida." };
}

/** Nome e WhatsApp do próprio perfil. */
export async function updateMyProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = String(fd.get("full_name") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").replace(/\D/g, "");
  const birth = String(fd.get("birth_date") ?? "");
  if (name.length < 2) return { error: "Informe seu nome." };
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { error: "Data de nascimento inválida." };
  if (phone && !/^\d{10,13}$/.test(phone)) return { error: "WhatsApp inválido (DDD + número)." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  const { error } = await supabase.from("profiles").update({ full_name: name, phone: phone || null, birth_date: birth || null }).eq("id", user.id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: "Perfil salvo!" };
}

/** Personal liga/desliga a vitrine (aparecer para alunos que procuram um Personal). */
export async function setDirectoryListed(_: ActionState, fd: FormData): Promise<ActionState> {
  const listed = fd.get("listed") === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  if (listed) {
    const { data: me } = await supabase.from("profiles").select("phone").eq("id", user.id).single();
    if (!me?.phone) return { error: "Cadastre seu WhatsApp acima antes de aparecer para os alunos." };
  }
  const { error } = await supabase.from("profiles").update({ directory_listed: listed }).eq("id", user.id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: listed ? "Pronto! Você aparece para alunos procurando Personal. 🎉" : "Você não aparece mais na busca de Personais." };
}
