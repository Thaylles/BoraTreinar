import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkoutRunner } from "@/components/workout/workout-runner";
import { requireRole } from "@/lib/auth";
import { loadRunnerForPlan } from "@/lib/runner-server";
import { getWeighInStatus } from "@/lib/weight-server";
import { WeighInGate } from "@/components/weight/weigh-in-gate";

export const metadata: Metadata = { title: "Treinando" };

export default async function TreinarPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { profile } = await requireRole("aluno");
  const [data, weighIn] = await Promise.all([loadRunnerForPlan(planId, profile.id), getWeighInStatus(profile.id)]);
  if (!data || !data.exercises.length) notFound();
  // Trava: com a pesagem vencida o aluno registra o peso antes de começar.
  if (weighIn.overdue) return <WeighInGate status={weighIn} next={`/aluno/treinar/${planId}`} />;

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
