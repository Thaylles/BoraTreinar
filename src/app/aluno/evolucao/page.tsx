import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
      <Link
        href="/aluno/resumo"
        className="mb-4 flex items-center gap-3 rounded-3xl bg-gradient-to-br from-bandeira-500 to-bandeira-700 p-4 text-white shadow-md transition hover:brightness-105"
      >
        <span className="text-3xl" aria-hidden>📊</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold">Resumo do mês</span>
          <span className="block text-sm text-white/85">Treinos, recordes, frequência e cardio — para compartilhar no WhatsApp e Instagram.</span>
        </span>
        <ChevronRight className="size-5" aria-hidden />
      </Link>
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
