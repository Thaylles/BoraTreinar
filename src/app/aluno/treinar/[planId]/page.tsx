import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkoutRunner } from "@/components/workout/workout-runner";
import { requireRole } from "@/lib/auth";
import { loadRunnerForPlan } from "@/lib/runner-server";

export const metadata: Metadata = { title: "Treinando" };

export default async function TreinarPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { profile } = await requireRole("aluno");
  const data = await loadRunnerForPlan(planId, profile.id);
  if (!data || !data.exercises.length) notFound();

  return (
    <WorkoutRunner
      studentId={profile.id}
      planId={planId}
      planName={data.plan.name}
      kind="ficha"
      exercises={data.exercises}
      storageKey={`bt:treino:${profile.id}:${planId}`}
      backHref="/aluno"
    />
  );
}
