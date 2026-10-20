import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { PlanEditor } from "@/components/plans/plan-editor";
import { requireRole } from "@/lib/auth";
import { loadCatalogFor } from "@/lib/plans-server";

export const metadata: Metadata = { title: "Nova ficha" };

export default async function NovaFichaAlunoPage() {
  const { profile } = await requireRole("aluno");
  // Personal no "Meu treino" monta modelos na área de Personal.
  if (profile.role === "personal") redirect("/personal/modelos");
  const catalog = await loadCatalogFor(profile.id);
  return (
    <>
      <Link href="/aluno" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Início
      </Link>
      <PageTitle sub="Monte um treino para repetir quando quiser. Ele fica salvo na sua conta.">Nova ficha</PageTitle>
      <PlanEditor
        mode="aluno"
        catalog={catalog}
        initial={{ planId: null, studentId: profile.id, name: "", goal: "", notes: "", validUntil: "", items: [] }}
      />
    </>
  );
}
