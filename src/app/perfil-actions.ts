"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { AVATAR_BUCKET } from "@/lib/avatar";
import { birthDateError } from "@/lib/age";
import { isCity } from "@/lib/cities";
import { spDateKey } from "@/lib/week";

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
  const birthError = birth ? birthDateError(birth, spDateKey()) : null;
  if (birthError) return { error: birthError };
  if (phone && !/^\d{10,13}$/.test(phone)) return { error: "WhatsApp inválido (DDD + número)." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  if (!birth) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role === "personal") return { error: "Informe sua data de nascimento: os alunos veem sua idade na busca de Personais." };
  }
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
    const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!me?.phone) return { error: "Cadastre seu WhatsApp acima antes de aparecer para os alunos." };
    if (!me.birth_date) return { error: "Cadastre sua data de nascimento acima: os alunos veem sua idade." };
    if (!me.service_cities?.length) return { error: "Escolha as cidades onde você atende antes de aparecer para os alunos." };
  }
  const { error } = await supabase.from("profiles").update({ directory_listed: listed }).eq("id", user.id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: listed ? "Pronto! Você aparece para alunos procurando Personal. 🎉" : "Você não aparece mais na busca de Personais." };
}

/** Cidades onde o Personal atende (códigos IBGE do RS). */
export async function saveServiceCities(_: ActionState, fd: FormData): Promise<ActionState> {
  const codes = [...new Set(fd.getAll("city").map(Number))].filter(isCity);
  if (codes.length > 100) return { error: "Máximo de 100 cidades." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  const { error } = await supabase.from("profiles").update({ service_cities: codes }).eq("id", user.id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  if (!codes.length) return { ok: "Cidades removidas. Sem cidades, você não aparece para novos alunos." };
  return { ok: `Pronto! ${codes.length} ${codes.length === 1 ? "cidade salva" : "cidades salvas"}.` };
}

/** Troca (ou remove, com null) o logo do Personal e apaga o arquivo antigo. */
export async function setLogo(path: string | null): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  if (path !== null && !path.startsWith(`${user.id}/logo-`)) return { error: "Logo inválido." };
  const { data: current } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (current?.role !== "personal") return { error: "Só Personais podem colocar logo." };
  const { error } = await supabase.from("profiles").update({ logo_path: path }).eq("id", user.id);
  if (error) return { error: friendlyError(error.message) };
  if (current.logo_path && current.logo_path !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([current.logo_path]);
  }
  revalidatePath("/", "layout");
  return { ok: path ? "Logo salvo! Seus alunos já veem sua marca no app. ✨" : "Logo removido." };
}
