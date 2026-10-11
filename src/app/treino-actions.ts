"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import type { SessionPayload } from "@/lib/outbox";

export type SaveSessionResult =
  | { ok: true; id: string; prs: string[]; duplicate: boolean }
  | { ok: false; error: string };

export async function saveSession(payload: SessionPayload): Promise<SaveSessionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_workout_session", { p: payload });
  if (error) return { ok: false, error: friendlyError(error.message) };
  const r = data as { id: string; prs: string[]; duplicate: boolean };
  revalidatePath("/aluno", "layout");
  revalidatePath("/personal", "layout");
  return { ok: true, id: r.id, prs: r.prs ?? [], duplicate: r.duplicate };
}

/** Aluno avalia o treino: esforço 1–5, dor e comentário (avisa o Personal se houver dor). */
export async function rateSession(input: { sessionId: string; effort: number; pain: boolean; feedback: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rate_workout_session", {
    p_session: input.sessionId,
    p_effort: Math.round(input.effort),
    p_pain: input.pain,
    p_feedback: input.feedback.trim().slice(0, 500) || null,
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/aluno", "layout");
  revalidatePath("/personal", "layout");
  return {};
}

export async function deleteSession(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("workout_sessions").delete().eq("id", String(fd.get("id")));
  revalidatePath("/aluno", "layout");
  revalidatePath("/personal", "layout");
}
