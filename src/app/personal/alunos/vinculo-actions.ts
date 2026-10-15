"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export type FoundStudent = { id: string; full_name: string; avatar_path: string | null; linked: boolean; pending: boolean };
export type FindState = { error?: string; results?: FoundStudent[]; query?: string } | undefined;

/** Busca um aluno com conta pelo e-mail ou WhatsApp exatos. */
export async function findStudent(_: FindState, fd: FormData): Promise<FindState> {
  const query = String(fd.get("q") ?? "").trim();
  if (!query) return { error: "Digite o e-mail ou o WhatsApp do aluno." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_student_for_link", { p_query: query });
  if (error) return { error: friendlyError(error.message), query };
  return { results: data ?? [], query };
}

export async function requestLink(studentId: string): Promise<{ error?: string; ok?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_student_link", { p_student: studentId });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/personal/alunos");
  return { ok: "Pedido enviado! O aluno recebe um aviso e confirma no app." };
}

export async function cancelLink(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("cancel_link_request", { p_request: String(fd.get("id")) });
  revalidatePath("/personal/alunos");
}
