import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { PlanEditor } from "@/components/plans/plan-editor";
import { requireRole } from "@/lib/auth";
import { loadCatalogFor } from "@/lib/plans-server";

export const metadata: Metadata = { title: "Novo modelo" };

export default async function NovoModeloPage() {
  await requireRole("personal");
  const catalog = await loadCatalogFor(null);
  return (
    <>
      <Link href="/personal/modelos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Modelos
      </Link>
      <PageTitle sub="Monte uma vez e aplique para vários alunos.">Novo modelo</PageTitle>
      <PlanEditor
        catalog={catalog}
        initial={{ planId: null, studentId: null, name: "", goal: "", notes: "", validUntil: "", items: [] }}
      />
    </>
  );
}
