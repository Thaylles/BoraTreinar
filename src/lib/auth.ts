import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import type { Enums, Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;

/** Usuário logado + perfil (memoizado por requisição). */
export const getSessionProfile = cache(async () => {
  await connection(); // sempre dinâmico, mesmo sem variáveis do Supabase no build
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { user, profile };
});

/**
 * O admin também entra nas áreas de Personal e de aluno (modos da mesma conta).
 * O Personal entra na área de aluno para o próprio treino ("Meu treino").
 */
export const canActAs = (actual: Enums<"user_role">, role: Enums<"user_role">) =>
  actual === role || (actual === "admin" && role !== "admin") || (actual === "personal" && role === "aluno");

export async function requireRole(role: Enums<"user_role">) {
  const session = await getSessionProfile();
  if (!session) redirect("/entrar");
  if (!canActAs(session.profile.role, role)) redirect(homeFor(session.profile.role));
  return session;
}

/** Telas só de aluno (Personais, aulas, conta de aluno): o Personal no "Meu treino" volta para o início. */
export async function requireStudent() {
  const session = await requireRole("aluno");
  if (session.profile.role === "personal") redirect("/aluno");
  return session;
}

export const homeFor = (role: Enums<"user_role">) =>
  role === "admin" ? "/admin" : role === "personal" ? "/personal" : "/aluno";

/** Aceita apenas caminhos internos para evitar open redirect. */
export function safeNext(next: unknown): string | null {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : null;
}
