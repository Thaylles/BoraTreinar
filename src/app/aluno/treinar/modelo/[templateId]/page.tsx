import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkoutRunner } from "@/components/workout/workout-runner";
import { requireRole } from "@/lib/auth";
import { loadRunnerForTemplate } from "@/lib/runner-server";
import { getWeighInStatus } from "@/lib/weight-server";
import { WeighInGate } from "@/components/weight/weigh-in-gate";

export const metadata: Metadata = { title: "Treinando" };

/** "Meu treino" do Personal: treina com um dos próprios modelos (vira um treino livre com o nome do modelo). */
export default async function TreinarModeloPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const { profile } = await requireRole("aluno");
  const [data, weighIn] = await Promise.all([loadRunnerForTemplate(templateId, profile.id), getWeighInStatus(profile.id)]);
  if (!data || !data.exercises.length) notFound();
  if (weighIn.overdue) return <WeighInGate status={weighIn} next={`/aluno/treinar/modelo/${templateId}`} />;

  return (
    <WorkoutRunner
      studentId={profile.id}
      planId={null}
      planName={data.plan.name}
      kind="livre"
      exercises={data.exercises}
      storageKey={`bt:treino:${profile.id}:modelo:${templateId}`}
      backHref="/aluno"
    />
  );
}
