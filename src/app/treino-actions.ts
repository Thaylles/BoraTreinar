"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";
import type { SessionPayload } from "@/lib/outbox";
import { getSessionProfile } from "@/lib/auth";
import { loadCautions } from "@/lib/health-server";
import { AI_PROVIDERS, extractJson } from "@/lib/ai";
import { SWAP_SYSTEM, parseSwap, swapPrompt } from "@/lib/swaps";

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

/**
 * "Aparelho ocupado": a IA escolhe 1–2 exercícios parecidos entre os candidatos do mesmo grupo
 * (levando em conta a anamnese do aluno). Sem IA configurada ou se ela falhar, volta vazio e a
 * tela usa os candidatos por regra.
 */
export async function suggestSubstitutes(input: {
  studentId: string;
  original: { id: string; name: string; muscle_group: string };
  candidates: { id: string; name: string; muscle_group: string }[];
}): Promise<{ ids: string[]; reason: string | null; source: "ia" | "regras" }> {
  const none = { ids: [], reason: null, source: "regras" as const };
  const session = await getSessionProfile();
  if (!session || !input.candidates.length) return none;
  const candidates = input.candidates.slice(0, 8).map((c) => ({ ...c, name: c.name.slice(0, 80) }));
  const cautions = (await loadCautions(input.studentId))[input.original.muscle_group] ?? [];
  const prompt = swapPrompt(input.original, candidates, cautions);
  for (const p of AI_PROVIDERS.filter((x) => x.enabled())) {
    try {
      const text = await p.call(SWAP_SYSTEM, prompt, { maxTokens: 300, timeoutMs: 8000, json: true });
      const r = parseSwap(extractJson(text), candidates.map((c) => c.id));
      if (r.ids.length) return { ...r, source: "ia" };
    } catch (e) {
      console.error(`IA de troca (${p.source}) falhou:`, e instanceof Error ? e.message : e);
    }
  }
  return none;
}

/** Comentário no treino (aluno ou Personal vinculado). O outro lado recebe uma notificação. */
export async function addSessionComment(_: ActionState, fd: FormData): Promise<ActionState> {
  const sessionId = String(fd.get("session_id") ?? "");
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { error: "Escreva o comentário." };
  if (body.length > 1000) return { error: "Máximo de 1000 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_session_comment", { p_session: sessionId, p_body: body });
  if (error) return { error: friendlyError(error.message) };
  revalidateComments(sessionId);
  return { ok: "Comentário enviado." };
}

export async function deleteSessionComment(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("session_comments").delete().eq("id", String(fd.get("id")));
  revalidateComments(String(fd.get("session_id")));
}

function revalidateComments(sessionId: string) {
  revalidatePath(`/aluno/historico/${sessionId}`);
  revalidatePath(`/personal/treinos/${sessionId}`);
}
