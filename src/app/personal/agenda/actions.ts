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
      start_time: time,
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
