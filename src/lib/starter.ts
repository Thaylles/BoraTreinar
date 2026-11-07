import "server-only";
import { createClient } from "@/lib/supabase/server";

export const LEVELS = [
  {
    key: "iniciante",
    label: "Iniciante",
    emoji: "🌱",
    sub: "Começando agora ou voltando depois de muito tempo. Corpo todo, 3x por semana.",
  },
  { key: "intermediario", label: "Intermediário", emoji: "💪", sub: "Treina há uns 6 meses com regularidade. Divisão em 4 dias." },
  { key: "avancado", label: "Avançado", emoji: "🔥", sub: "Treina há mais de 2 anos e domina os básicos. 4 dias intensos." },
] as const;
export type Level = (typeof LEVELS)[number]["key"];

export type StarterWorkout = {
  id: string;
  level: Level;
  name: string;
  goal: string | null;
  notes: string | null;
  items: { sets: number; reps_min: number | null; reps_max: number | null; technique: string | null; equipment: { name: string } | null }[];
};

/** Os 12 treinos prontos com os exercícios, na ordem. */
export async function loadStarterWorkouts(): Promise<StarterWorkout[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("starter_workouts")
    .select(
      "id, level, name, goal, notes, position, items:starter_workout_items(position, sets, reps_min, reps_max, technique, equipment(name))",
    )
    .order("position")
    .order("position", { referencedTable: "starter_workout_items" });
  return (data ?? []) as unknown as StarterWorkout[];
}
