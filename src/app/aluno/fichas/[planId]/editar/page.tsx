import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { PlanEditor } from "@/components/plans/plan-editor";
import { requireRole } from "@/lib/auth";
import { loadCatalogFor, loadPlan } from "@/lib/plans-server";
import { toEditorItems } from "@/lib/plans";

export const metadata: Metadata = { title: "Editar ficha" };

/** O aluno edita só as fichas que ele mesmo criou. */
export default async function EditarFichaAlunoPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { profile } = await requireRole("aluno");
  const loaded = await loadPlan(planId);
  if (!loaded || loaded.plan.is_template || loaded.plan.created_by !== profile.id || loaded.plan.student_id !== profile.id) notFound();
  const { plan, items } = loaded;
  const catalog = await loadCatalogFor(profile.id);
  return (
    <>
      <Link href={`/aluno/fichas/${planId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {plan.name}
      </Link>
      <PageTitle>Editar ficha</PageTitle>
      <PlanEditor
        mode="aluno"
        catalog={catalog}
        initial={{
          planId,
          studentId: profile.id,
          name: plan.name,
          goal: plan.goal ?? "",
          notes: plan.notes ?? "",
          validUntil: "",
          items: toEditorItems(items),
        }}
      />
    </>
  );
}
