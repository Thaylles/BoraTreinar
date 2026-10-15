import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/card";
import { AchievementsView, type AchievementFilter } from "@/components/achievements/achievements-view";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conquistas" };

const FILTERS = ["todas", "conquistadas", "faltam", "secretas"];

export default async function ConquistasPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await requireRole("aluno");
  const sp = await searchParams;
  const filter = (FILTERS.includes(sp.filtro ?? "") ? sp.filtro : "todas") as AchievementFilter;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_achievements", {});
  return (
    <>
      <PageTitle sub="Treine, bata metas e recordes para liberar troféus. Algumas são secretas! 🤫">Conquistas</PageTitle>
      <AchievementsView rows={data ?? []} filter={filter} basePath="/aluno/conquistas" />
    </>
  );
}
