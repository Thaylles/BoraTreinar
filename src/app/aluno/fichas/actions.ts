"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { isTechnique } from "@/lib/plans";
import type { PlanPayload } from "@/app/personal/fichas/actions";

type MyPlanPayload = Pick<PlanPayload, "planId" | "name" | "goal" | "notes" | "items">;

/** O aluno salva uma ficha própria (nova ou editada). */
export async function saveMyPlan(p: MyPlanPayload): Promise<{ error: string } | void> {
  if (!p.name.trim()) return { error: "Dê um nome para a ficha (ex.: Treino A)." };
  if (!p.items.length) return { error: "Adicione pelo menos um exercício." };
  if (p.items.some((it) => it.technique !== null && !isTechnique(it.technique))) return { error: "Técnica inválida." };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_my_plan", {
    p_plan: p.planId,
    p_name: p.name,
    p_goal: p.goal || null,
    p_notes: p.notes || null,
    // Ficha do aluno não tem substituto indicado (no treino, o app sugere trocas).
    p_items: p.items.map((it) => ({ ...it, substitute_equipment_id: null })),
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/aluno", "layout");
  redirect(`/aluno/fichas/${id}?salvo=1`);
}

/** Exclui uma ficha que o próprio aluno criou (os treinos feitos continuam no histórico). */
export async function deleteMyPlan(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("workout_plans").delete().eq("id", String(fd.get("id"))).eq("created_by", user.id).eq("student_id", user.id);
  revalidatePath("/aluno", "layout");
  redirect("/aluno?ficha_excluida=1");
}

/** Treino livre → ficha: salva a seleção do dia com séries e descanso padrão (o aluno ajusta depois). */
export async function saveFreeAsPlan(name: string, equipmentIds: string[]): Promise<{ id?: string; error?: string }> {
  if (!name.trim()) return { error: "Dê um nome para a ficha." };
  if (!equipmentIds.length) return { error: "Escolha pelo menos um exercício." };
  const supabase = await createClient();
  const { data: cardio } = await supabase.from("equipment").select("id").in("id", equipmentIds).eq("muscle_group", "cardio");
  const isCardio = new Set((cardio ?? []).map((c) => c.id));
  const { data: id, error } = await supabase.rpc("save_my_plan", {
    p_plan: null,
    p_name: name,
    p_goal: null,
    p_notes: null,
    p_items: equipmentIds.map((equipment_id) =>
      isCardio.has(equipment_id)
        ? { equipment_id, sets: 1, reps_min: 20, reps_max: 20, rest_seconds: 0 }
        : { equipment_id, sets: 3, reps_min: 10, reps_max: 12, rest_seconds: 60 },
    ),
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/aluno", "layout");
  return { id: id ?? undefined };
}

/** "Não encontrou o exercício?": pedido para Personais e admins adicionarem ao catálogo. */
export async function requestExercise(name: string, note: string): Promise<ActionState> {
  if (name.trim().length < 2) return { error: "Escreva o nome do exercício ou da máquina." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_exercise", { p_name: name, p_note: note || null });
  if (error) return { error: friendlyError(error.message) };
  return { ok: "Pedido enviado! Você recebe um aviso quando o exercício entrar no catálogo." };
}
