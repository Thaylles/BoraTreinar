import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ExerciseHistory } from "@/components/workout/exercise-history";
import { requireRole } from "@/lib/auth";
import { loadExerciseTimeline } from "@/lib/sessions-server";

export const metadata: Metadata = { title: "Evolução do exercício" };

export default async function PersonalExercicioAlunoPage({
  params,
}: {
  params: Promise<{ id: string; equipmentId: string }>;
}) {
  const { id, equipmentId } = await params;
  await requireRole("personal");
  const data = await loadExerciseTimeline(id, equipmentId);
  if (!data.equipment) notFound();
  return (
    <>
      <Link href={`/personal/alunos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Aluno
      </Link>
      <ExerciseHistory data={data} sessionHref={(sid) => `/personal/treinos/${sid}`} />
    </>
  );
}
