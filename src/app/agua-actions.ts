"use server";

import { getSessionProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { BOTTLES, parseGoal } from "@/lib/water";
import { loadWaterToday, type WaterToday } from "@/lib/water-server";

type Result = { ok: true; water: WaterToday } | { ok: false; error: string };

async function me() {
  const session = await getSessionProfile();
  if (!session) throw new Error("Sessão expirada. Entre de novo.");
  return session.profile.id;
}

// O cartão de água se atualiza com o resultado (sem recarregar a tela inicial inteira).
const done = async (userId: string): Promise<Result> => ({ ok: true, water: await loadWaterToday(userId) });

/** Meta e total de hoje (para o botão de água durante o treino). */
export async function waterToday(): Promise<Result> {
  try {
    return { ok: true, water: await loadWaterToday(await me()) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Registra uma garrafa (500 ml, 1 L, 1,5 L ou 2 L). */
export async function addWater(ml: number): Promise<Result> {
  try {
    const userId = await me();
    if (!BOTTLES.includes(ml as (typeof BOTTLES)[number])) return { ok: false, error: "Quantidade inválida." };
    const supabase = await createClient();
    const { error } = await supabase.from("water_logs").insert({ user_id: userId, ml });
    if (error) return { ok: false, error: friendlyError(error.message) };
    return done(userId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Desfaz um registro (o último, pelo botão "Desfazer"). */
export async function removeWater(id: string): Promise<Result> {
  try {
    const userId = await me();
    const supabase = await createClient();
    const { error } = await supabase.from("water_logs").delete().eq("id", id).eq("user_id", userId);
    if (error) return { ok: false, error: friendlyError(error.message) };
    return done(userId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Define a meta diária (em litros) e liga/desliga os lembretes. */
export async function saveWaterGoal(liters: string, reminders: boolean): Promise<Result> {
  try {
    const userId = await me();
    const ml = parseGoal(liters);
    if (!ml) return { ok: false, error: "Meta entre 0,5 e 8 litros." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("water_settings")
      .upsert({ user_id: userId, daily_ml: ml, reminders, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: friendlyError(error.message) };
    return done(userId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
