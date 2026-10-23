import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { PlanEditor } from "@/components/plans/plan-editor";
import { loadCautions } from "@/lib/health-server";
import { requireRole } from "@/lib/auth";
import { loadCatalogFor, loadPlan } from "@/lib/plans-server";
import { toEditorItems } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar ficha" };

export default async function EditarFichaPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  await requireRole("personal");
  const loaded = await loadPlan(planId);
  if (!loaded) notFound();
  const { plan, items } = loaded;
  // Ficha montada pelo próprio aluno: só ele edita, a não ser que libere a edição para o Personal.
  const supabase = await createClient();
  const { data: canEdit } = await supabase.rpc("can_edit_plan", { p_plan: planId });
  if (!canEdit) redirect(`/personal/fichas/${planId}`);
  const catalog = await loadCatalogFor(plan.student_id);

  return (
    <>
      <Link href={`/personal/fichas/${planId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {plan.name}
      </Link>
      <PageTitle sub={plan.is_template ? "Modelo" : `Ficha de ${plan.student?.full_name ?? "aluno"}`}>Editar ficha</PageTitle>
      <PlanEditor
        cautions={await loadCautions(plan.student_id)}
        catalog={catalog}
        initial={{
          planId,
          studentId: plan.student_id,
          name: plan.name,
          goal: plan.goal ?? "",
          notes: plan.notes ?? "",
          validUntil: plan.valid_until ?? "",
          items: toEditorItems(items),
        }}
      />
    </>
  );
}
