import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/dashboard-server";
import { getStudentSettings } from "@/lib/weight-server";

export const metadata: Metadata = { title: "Evolução do aluno" };

export default async function PersonalEvolucaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; ref?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requireRole("personal");
  const supabase = await createClient();
  // O RLS só devolve o perfil de alunos vinculados a este Personal.
  const { data: student } = await supabase.from("profiles").select("full_name").eq("id", id).in("role", ["aluno", "admin"]).maybeSingle();
  if (!student) notFound();
  const [data, settings] = await Promise.all([
    loadDashboard(id, sp.periodo === "mes" ? "mes" : "semana", sp.ref),
    getStudentSettings(id),
  ]);
  return (
    <>
      <Link href={`/personal/alunos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Aluno
      </Link>
      <PageTitle sub="Semana e mês, com comparação ao período anterior.">Evolução de {student.full_name}</PageTitle>
      <DashboardView
        data={data}
        basePath={`/personal/alunos/${id}/evolucao`}
        exerciseHref={(eid) => `/personal/alunos/${id}/exercicios/${eid}`}
        weightHiddenText={settings.weightVisible ? "Nenhuma pesagem registrada ainda." : "🔒 O aluno não compartilha o peso com os Personais."}
      />
    </>
  );
}
