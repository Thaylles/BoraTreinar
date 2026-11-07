import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { StarterCatalog } from "@/components/starter/starter-catalog";
import { requireRole } from "@/lib/auth";
import { loadStarterWorkouts } from "@/lib/starter";

export const metadata: Metadata = { title: "Treinos prontos" };

export default async function PersonalTreinosProntosPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [, sp] = await Promise.all([requireRole("personal"), searchParams]);
  const workouts = await loadStarterWorkouts();
  return (
    <>
      <Link href="/personal/modelos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Modelos
      </Link>
      <PageTitle sub="Copie os 4 treinos de um nível para os seus modelos, ajuste do seu jeito e aplique nos alunos.">
        Treinos prontos
      </PageTitle>
      <StarterCatalog workouts={workouts} asTemplates error={sp.erro} />
    </>
  );
}
