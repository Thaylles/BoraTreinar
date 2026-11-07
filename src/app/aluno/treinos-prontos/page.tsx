import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { StarterCatalog } from "@/components/starter/starter-catalog";
import { requireRole } from "@/lib/auth";
import { loadStarterWorkouts } from "@/lib/starter";

export const metadata: Metadata = { title: "Treinos prontos" };

export default async function AlunoTreinosProntosPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [, sp] = await Promise.all([requireRole("aluno"), searchParams]);
  const workouts = await loadStarterWorkouts();
  return (
    <>
      <Link href="/aluno" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Início
      </Link>
      <PageTitle sub="Escolha o seu nível: os 4 treinos viram fichas suas, e você pode ajustar o que quiser depois.">
        Treinos prontos
      </PageTitle>
      <StarterCatalog workouts={workouts} asTemplates={false} error={sp.erro} />
      <p className="mt-6 text-xs text-muted">
        Sugestões gerais para quem está começando. Se tiver dor, lesão ou alguma condição de saúde, fale com um profissional antes de
        treinar.
      </p>
    </>
  );
}
