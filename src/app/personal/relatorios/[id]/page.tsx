import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { ReportView } from "@/components/report/report-view";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReportContent } from "@/lib/report";

export const metadata: Metadata = { title: "Relatório semanal" };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default async function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("personal");
  const supabase = await createClient();
  const { data: report } = await supabase.from("weekly_reports").select("id, content, ai_used, emailed_at, updated_at").eq("id", id).maybeSingle();
  if (!report) notFound();
  const c = report.content as unknown as ReportContent;
  const generated = new Date(report.updated_at).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <>
      <Link href="/personal/relatorios" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Relatórios
      </Link>
      <PageTitle sub={`Gerado em ${generated}${report.emailed_at ? " · enviado por e-mail" : ""}`}>
        Semana {ddmm(c.week_start)} a {ddmm(c.week_end)}
      </PageTitle>
      <ReportView content={c} />
    </>
  );
}
