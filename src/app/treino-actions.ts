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

export async function deleteSession(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("workout_sessions").delete().eq("id", String(fd.get("id")));
  revalidatePath("/aluno", "layout");
  revalidatePath("/personal", "layout");
}
