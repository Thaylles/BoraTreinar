"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";
import { friendlyError, type ActionState } from "@/lib/errors";
import { spDateKey } from "@/lib/week";

export async function saveWeight(_: ActionState, fd: FormData): Promise<ActionState> {
  const kg = Number(String(fd.get("weight_kg") ?? "").replace(",", ".").trim());
  if (!Number.isFinite(kg) || kg < 20 || kg > 400) return { error: "Informe um peso entre 20 e 400 kg." };
  const date = String(fd.get("measured_on") ?? "") || spDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  // Uma pesagem por dia: se já existe, atualiza.
  const { data: updated, error: upErr } = await supabase
    .from("body_weights")
    .update({ weight_kg: kg })
    .eq("student_id", user.id)
    .eq("measured_on", date)
    .select("id");
  if (upErr) return { error: friendlyError(upErr.message) };
  if (!updated?.length) {
    const { error } = await supabase
      .from("body_weights")
      .insert({ student_id: user.id, weight_kg: kg, measured_on: date });
    if (error) return { error: friendlyError(error.message) };
  }

  revalidatePath("/aluno", "layout");
  const next = safeNext(fd.get("next"));
  if (next) redirect(next);
  return { ok: "Peso registrado! ✅" };
}

export async function deleteWeight(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("body_weights").delete().eq("id", String(fd.get("id")));
  revalidatePath("/aluno", "layout");
}

export async function saveWeightSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const visible = fd.get("weight_visible") === "on";
  const frequency = fd.get("frequency") === "quinzenal" ? "quinzenal" : "semanal";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { data: updated, error: upErr } = await supabase
    .from("student_settings")
    .update({ weight_visible_to_personal: visible, weigh_in_frequency: frequency })
    .eq("student_id", user.id)
    .select("student_id");
  if (upErr) return { error: friendlyError(upErr.message) };
  if (!updated?.length) {
    const { error } = await supabase
      .from("student_settings")
      .insert({ student_id: user.id, weight_visible_to_personal: visible, weigh_in_frequency: frequency });
    if (error) return { error: friendlyError(error.message) };
  }
  revalidatePath("/aluno", "layout");
  return { ok: "Preferências salvas." };
}
