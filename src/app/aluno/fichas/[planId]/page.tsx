import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Play, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteMyPlan } from "../actions";
import { Card } from "@/components/ui/card";
import { PlanItemsList } from "@/components/plans/plan-view";
import { PlanExportButtons } from "@/components/plans/export-buttons";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { loadPlan } from "@/lib/plans-server";

export const metadata: Metadata = { title: "Ficha" };

export default async function AlunoFichaPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { planId } = await params;
  const saved = (await searchParams).salvo === "1";
  const { profile } = await requireRole("aluno");
  const loaded = await loadPlan(planId);
  if (!loaded || loaded.plan.is_template) notFound();
  const { plan, items } = loaded;
  const mine = plan.created_by === profile.id && plan.student_id === profile.id;

  return (
    <>
      <Link href="/aluno" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Início
      </Link>
      {saved && (
        <Alert kind="success" className="mb-4">
          Ficha salva! ✅
        </Alert>
      )}
      <h1 className="font-display text-3xl font-extrabold leading-tight">{plan.name}</h1>
      {plan.goal && <p className="text-muted">🎯 {plan.goal}</p>}
      <p className="mb-4 mt-1 text-xs text-muted">
        {mine ? "Criada por você" : `Montada por ${plan.creator?.full_name ?? "seu Personal"}`}
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
      {mine && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href={`/aluno/fichas/${plan.id}/editar`}
            className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-semibold hover:border-bandeira-500"
          >
            <Pencil className="size-4" aria-hidden /> Editar ficha
          </Link>
          <form action={deleteMyPlan}>
            <input type="hidden" name="id" value={plan.id} />
            <ConfirmSubmit
              message={`Excluir a ficha "${plan.name}"? Os treinos já feitos continuam no histórico.`}
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15"
            >
              <Trash2 className="size-4" aria-hidden /> Excluir
            </ConfirmSubmit>
          </form>
        </div>
      )}
    </>
  );
}
