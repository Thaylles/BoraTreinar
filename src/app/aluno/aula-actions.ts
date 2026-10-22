"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/** O aluno pede para trocar uma aula para outro dia/horário (mesma semana ou a seguinte). */
export async function requestClassChange(_: ActionState, fd: FormData): Promise<ActionState> {
  const scheduleId = String(fd.get("schedule_id") ?? "");
  const date = String(fd.get("date") ?? "");
  const newDate = String(fd.get("new_date") ?? "");
  const time = String(fd.get("new_time") ?? "");
  const note = String(fd.get("note") ?? "").trim() || null;
  if (!scheduleId || !isDate(date)) return { error: "Aula inválida." };
  if (!isDate(newDate)) return { error: "Escolha o novo dia." };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Escolha o horário." };
  if (note && note.length > 300) return { error: "Recado muito longo (máx. 300 caracteres)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_class_change", {
    p_schedule: scheduleId,
    p_date: date,
    p_new_date: newDate,
    p_new_time: time,
    p_note: note,
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/aluno/aulas");
  return { ok: "Pedido enviado! Seu Personal vai responder. 🔄" };
}

/** O aluno desiste de um pedido de troca ainda pendente. */
export async function cancelClassChange(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("cancel_class_change", { p_request: id });
  revalidatePath("/aluno/aulas");
}
