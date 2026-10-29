import "server-only";
import { createClient } from "@/lib/supabase/server";
import { spDateKey, spMidnightISO } from "@/lib/week";

export type WaterToday = { goalMl: number | null; reminders: boolean; totalMl: number; lastId: string | null; lastMl: number | null };

/** Meta de água e o que a pessoa logada já bebeu hoje (dia de São Paulo). */
export async function loadWaterToday(userId: string): Promise<WaterToday> {
  const supabase = await createClient();
  const [{ data: settings }, { data: logs }] = await Promise.all([
    supabase.from("water_settings").select("daily_ml, reminders").eq("user_id", userId).maybeSingle(),
    supabase
      .from("water_logs")
      .select("id, ml")
      .eq("user_id", userId)
      .gte("logged_at", spMidnightISO(spDateKey()))
      .order("logged_at", { ascending: false }),
  ]);
  return {
    goalMl: settings?.daily_ml ?? null,
    reminders: settings?.reminders ?? true,
    totalMl: (logs ?? []).reduce((a, l) => a + l.ml, 0),
    lastId: logs?.[0]?.id ?? null,
    lastMl: logs?.[0]?.ml ?? null,
  };
}
