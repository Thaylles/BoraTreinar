import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui/card";
import { AchievementsView, type AchievementFilter } from "@/components/achievements/achievements-view";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conquistas de Personal" };

const FILTERS = ["todas", "conquistadas", "faltam"];

export default async function PersonalConquistasPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await requireRole("personal");
  const sp = await searchParams;
  const filter = (FILTERS.includes(sp.filtro ?? "") ? sp.filtro : "todas") as AchievementFilter;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_achievements", { p_audience: "personal" });
  return (
    <>
      <PageTitle sub="Conquistas exclusivas de Personal: alunos, fichas, modelos, registros, agenda e financeiro.">
        Conquistas de Personal
      </PageTitle>
      <p className="mb-4 text-sm text-muted">
        As conquistas do seu próprio treino ficam em{" "}
        <Link href="/aluno/conquistas" className="font-semibold text-bandeira-600 hover:underline dark:text-bandeira-100">
          Meu treino → Conquistas
        </Link>
        .
      </p>
      <AchievementsView rows={data ?? []} filter={filter} basePath="/personal/conquistas" />
    </>
  );
}
