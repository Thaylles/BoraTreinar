import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlanItemsList } from "@/components/plans/plan-view";
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
      <PlanItemsList items={items} />
      <p className="mt-6 rounded-2xl bg-ipe-100 p-4 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
        🚧 O botão &quot;Iniciar treino&quot; chega na próxima etapa.
      </p>
    </>
  );
}
