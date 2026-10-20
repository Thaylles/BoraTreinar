import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { loadCatalogFor } from "@/lib/plans-server";
import { FREE_MAX_EXERCISES } from "@/lib/runner-server";
import { FreeBuilder } from "./free-builder";

export const metadata: Metadata = { title: "Treino livre" };

export default async function TreinoLivrePage() {
  const { profile } = await requireRole("aluno");
  const catalog = await loadCatalogFor(profile.id);
  return (
    <>
      <Link href="/aluno" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Início
      </Link>
      <PageTitle sub="Monte o treino de hoje com exercícios do catálogo. Se quiser repetir depois, salve como ficha.">
        Treino livre
      </PageTitle>
      <FreeBuilder catalog={catalog} max={FREE_MAX_EXERCISES} canSave={profile.role !== "personal"} />
    </>
  );
}
