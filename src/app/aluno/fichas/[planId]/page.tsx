import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlanItemsList } from "@/components/plans/plan-view";
import { PlanExportButtons } from "@/components/plans/export-buttons";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { loadPlan } from "@/lib/plans-server";

export const metadata: Metadata = { title: "Ficha" };

export default async function AlunoFichaPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  await requireRole("aluno");
  const loaded = await loadPlan(planId);
  if (!loaded || loaded.plan.is_template) notFound();
  const { plan, items } = loaded;

  return (
    <>
      <Link href="/aluno" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Início
      </Link>
      <h1 className="font-display text-3xl font-extrabold leading-tight">{plan.name}</h1>
      {plan.goal && <p className="text-muted">🎯 {plan.goal}</p>}
      <p className="mb-4 mt-1 text-xs text-muted">
        Montada por {plan.creator?.full_name ?? "seu Personal"}
        {plan.valid_until && ` · válida até ${formatDate(`${plan.valid_until}T12:00:00`)}`}
      </p>
      {plan.notes && <Card className="mb-4 whitespace-pre-line text-sm">{plan.notes}</Card>}
      <Link
        href={`/aluno/treinar/${plan.id}`}
        className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-bandeira-500 py-4 font-display text-lg font-bold text-white shadow-lg shadow-bandeira-500/25 hover:bg-bandeira-600"
      >
        <Play className="size-5" aria-hidden /> Iniciar treino
      </Link>
      <PlanItemsList items={items} />
      <div className="mt-6">
        <PlanExportButtons planId={plan.id} />
      </div>
    </>
  );
}
