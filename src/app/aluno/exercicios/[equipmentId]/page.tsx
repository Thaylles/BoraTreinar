import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ExerciseHistory } from "@/components/workout/exercise-history";
import { ExerciseDemo } from "@/components/exercise-media/exercise-demo";
import { requireRole } from "@/lib/auth";
import { loadExerciseTimeline } from "@/lib/sessions-server";

export const metadata: Metadata = { title: "Evolução do exercício" };

export default async function AlunoExercicioPage({ params }: { params: Promise<{ equipmentId: string }> }) {
  const { equipmentId } = await params;
  const { profile } = await requireRole("aluno");
  const data = await loadExerciseTimeline(profile.id, equipmentId);
  if (!data.equipment) notFound();
  return (
    <>
      <Link href="/aluno/historico" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Histórico
      </Link>
      <ExerciseHistory data={data} sessionHref={(id) => `/aluno/historico/${id}`} />
      <ExerciseDemo equipmentId={equipmentId} name={data.equipment.name} className="mt-6" />
    </>
  );
}
