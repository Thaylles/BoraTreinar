"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { weekdayOf } from "@/lib/schedule";

export async function addSchedule(_: ActionState, fd: FormData): Promise<ActionState> {
  const studentId = String(fd.get("student_id") ?? "");
  const single = fd.get("kind") === "unica";
  const onDate = String(fd.get("on_date") ?? "");
  const time = String(fd.get("start_time") ?? "");
  const duration = Number(fd.get("duration") ?? 60);
  const notes = String(fd.get("notes") ?? "").trim() || null;
  if (!studentId) return { error: "Escolha o aluno." };
  if (single && !/^\d{4}-\d{2}-\d{2}$/.test(onDate)) return { error: "Informe a data da aula." };
  // Aula única = linha com início e fim no mesmo dia (o banco confere o dia da semana).
  const weekdays = single
    ? [weekdayOf(onDate)]
    : fd.getAll("weekday").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const startsOn = single ? onDate : String(fd.get("starts_on") ?? "") || undefined;
  const endsOn = single ? onDate : null;
  if (!weekdays.length) return { error: "Escolha pelo menos um dia da semana." };
  // Horário próprio de cada dia (opcional); sem ele, vale o horário geral.
  const timeFor = (wd: number) => {
    const t = String(fd.get(`time_${wd}`) ?? "");
    return /^\d{2}:\d{2}$/.test(t) ? t : time;
  };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Informe o horário." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  const { error } = await supabase.from("class_schedules").insert(
    weekdays.map((weekday) => ({
      personal_id: user.id,
      student_id: studentId,
      weekday,
      start_time: single ? time : timeFor(weekday),
      duration_minutes: duration,
      starts_on: startsOn,
      ends_on: endsOn,
      notes,
    })),
  );
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/personal/alunos/${studentId}`);
  revalidatePath("/personal/agenda");
  if (single) return { ok: "Aula única agendada! 📅" };
  return { ok: weekdays.length > 1 ? "Aulas agendadas toda semana! 📅" : "Aula agendada toda semana! 📅" };
}

export async function deleteSchedule(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("class_schedules").delete().eq("id", String(fd.get("id")));
  revalidatePath("/personal", "layout");
}

export async function toggleOccurrence(fd: FormData) {
  const scheduleId = String(fd.get("schedule_id"));
  const date = String(fd.get("date"));
  const supabase = await createClient();
  if (fd.get("cancel") === "1") {
    await supabase.from("class_exceptions").insert({
      schedule_id: scheduleId,
      on_date: date,
      reason: String(fd.get("reason") ?? "").trim() || null,
    });
  } else {
    await supabase.from("class_exceptions").delete().eq("schedule_id", scheduleId).eq("on_date", date);
  }
  revalidatePath("/personal", "layout");
}

/** Remarca uma aula: só esta data ("unica") ou esta e as próximas ("serie"). */
export async function rescheduleClass(_: ActionState, fd: FormData): Promise<ActionState> {
  const scheduleId = String(fd.get("schedule_id") ?? "");
  const date = String(fd.get("date") ?? "");
  const time = String(fd.get("start_time") ?? "");
  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!scheduleId || !isDate(date)) return { error: "Aula inválida." };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Informe o novo horário." };

  const supabase = await createClient();
  if (fd.get("mode") === "serie") {
    const weekday = Number(fd.get("weekday"));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: "Escolha o novo dia da semana." };
    const { error } = await supabase.rpc("reschedule_class_series", {
      p_schedule: scheduleId,
      p_from: date,
      p_weekday: weekday,
      p_time: time,
    });
    if (error) return { error: friendlyError(error.message) };
  } else {
    const newDate = String(fd.get("new_date") ?? "");
    if (!isDate(newDate)) return { error: "Informe a nova data." };
    const { error } = await supabase.rpc("reschedule_class_once", {
      p_schedule: scheduleId,
      p_date: date,
      p_new_date: newDate,
      p_new_time: time,
    });
    if (error) return { error: friendlyError(error.message) };
  }
  revalidatePath("/personal", "layout");
  return { ok: "Aula remarcada! O aluno foi avisado. 🔄" };
}

/** O Personal aceita (remarca a aula) ou recusa o pedido de troca do aluno. */
export async function answerClassChange(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  const accept = fd.get("accept") === "1";
  const reply = String(fd.get("reply") ?? "").trim().slice(0, 300) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_class_change", { p_request: id, p_accept: accept, p_reply: reply });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/personal", "layout");
  revalidatePath("/aluno/aulas");
  return { ok: accept ? "Aula remarcada! O aluno foi avisado. 🔄" : "Pedido recusado. O aluno foi avisado." };
}
