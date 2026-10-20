"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { isMuscleGroup } from "@/lib/catalog";

function refresh() {
  revalidatePath("/personal", "layout");
  revalidatePath("/admin", "layout");
}

/** Volta para a lista de pedidos com o aviso de sucesso (o pedido atendido some da lista). */
function done(fd: FormData, message: string): never {
  const back = String(fd.get("back") ?? "");
  const path = back === "/admin/pedidos" ? back : "/personal/exercicios/pedidos";
  redirect(`${path}?ok=${encodeURIComponent(message)}`);
}

/** Personal ou admin adiciona o exercício pedido ao catálogo padrão. */
export async function addRequestedExercise(_: ActionState, fd: FormData): Promise<ActionState> {
  const key = String(fd.get("key") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const group = String(fd.get("muscle_group") ?? "");
  if (name.length < 2) return { error: "Informe o nome do exercício." };
  if (!isMuscleGroup(group)) return { error: "Escolha o grupo muscular." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_requested_exercise", {
    p_key: key,
    p_name: name,
    p_group: group,
    p_bodyweight: fd.get("is_bodyweight") === "on",
    p_description: String(fd.get("description") ?? "").trim() || null,
    p_intensity: group === "cardio" ? String(fd.get("intensity_unit") ?? "nivel") : null,
  });
  if (error) return { error: friendlyError(error.message) };
  refresh();
  done(fd, `"${name}" entrou no catálogo. Quem pediu já foi avisado! ✅`);
}

/** O exercício pedido já existe no catálogo (com outro nome). */
export async function linkRequestedExercise(_: ActionState, fd: FormData): Promise<ActionState> {
  const equipmentId = String(fd.get("equipment_id") ?? "");
  if (!equipmentId) return { error: "Escolha o exercício do catálogo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_requested_exercise", { p_key: String(fd.get("key") ?? ""), p_equipment: equipmentId });
  if (error) return { error: friendlyError(error.message) };
  refresh();
  done(fd, "Pronto! Avisamos quem pediu qual exercício usar. ✅");
}

/** Admin descarta um pedido. */
export async function dismissExerciseRequest(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("dismiss_exercise_request", { p_key: String(fd.get("key") ?? "") });
  refresh();
}
