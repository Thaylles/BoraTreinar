import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/card";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireRole } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-server";

export const metadata: Metadata = { title: "Evolução" };

export default async function AlunoEvolucaoPage({ searchParams }: { searchParams: Promise<{ periodo?: string; ref?: string }> }) {
  const { profile } = await requireRole("aluno");
  const sp = await searchParams;
  const data = await loadDashboard(profile.id, sp.periodo === "mes" ? "mes" : "semana", sp.ref);
  return (
    <>
      <PageTitle sub="Seu progresso na semana e no mês.">Evolução</PageTitle>
      <DashboardView
        data={data}
        basePath="/aluno/evolucao"
        exerciseHref={(eid) => `/aluno/exercicios/${eid}`}
        weightHiddenText="Registre seu peso na aba Peso para acompanhar aqui."
      />
    </>
  );
}
