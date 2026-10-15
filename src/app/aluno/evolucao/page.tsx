import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/card";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireRole } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-server";
import { createClient } from "@/lib/supabase/server";
import { AchievementsCard } from "@/components/achievements/achievements-card";

export const metadata: Metadata = { title: "Evolução" };

export default async function AlunoEvolucaoPage({ searchParams }: { searchParams: Promise<{ periodo?: string; ref?: string }> }) {
  const { profile } = await requireRole("aluno");
  const sp = await searchParams;
  const supabase = await createClient();
  const [data, { data: achievements }] = await Promise.all([
    loadDashboard(profile.id, sp.periodo === "mes" ? "mes" : "semana", sp.ref),
    supabase.rpc("my_achievements", {}),
  ]);
  return (
    <>
      <PageTitle sub="Seu progresso na semana e no mês.">Evolução</PageTitle>
      <AchievementsCard rows={achievements ?? []} href="/aluno/conquistas" />
      <DashboardView
        data={data}
        basePath="/aluno/evolucao"
        exerciseHref={(eid) => `/aluno/exercicios/${eid}`}
        weightHiddenText="Registre seu peso na aba Peso para acompanhar aqui."
      />
    </>
  );
}
