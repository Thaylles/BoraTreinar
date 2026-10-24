import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkoutRunner } from "@/components/workout/workout-runner";
import { requireRole } from "@/lib/auth";
import { resolveBackdate } from "@/lib/backdate-server";
import { loadRunnerForPlan } from "@/lib/runner-server";
import { getWeighInStatus } from "@/lib/weight-server";
import { WeighInGate } from "@/components/weight/weigh-in-gate";

export const metadata: Metadata = { title: "Treinando" };

export default async function TreinarPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ passado?: string; min?: string }>;
}) {
  const [{ planId }, sp] = await Promise.all([params, searchParams]);
  const { profile } = await requireRole("aluno");
  // Treino esquecido (até 7 dias atrás): fora do prazo volta para a escolha.
  const backdate = resolveBackdate(sp.passado, sp.min);
  if (sp.passado && !backdate) redirect("/aluno/registrar-passado?erro=data");
  const [data, weighIn] = await Promise.all([loadRunnerForPlan(planId, profile.id), getWeighInStatus(profile.id)]);
  if (!data || !data.exercises.length) notFound();
  // Trava: com a pesagem vencida o aluno registra o peso antes de começar (vale para o treino de agora).
  if (weighIn.overdue && !backdate) return <WeighInGate status={weighIn} next={`/aluno/treinar/${planId}`} />;

  return (
    <WorkoutRunner
      studentId={profile.id}
      planId={planId}
      planName={data.plan.name}
      kind="ficha"
      exercises={data.exercises}
      storageKey={`bt:treino:${profile.id}:${planId}${backdate ? `:passado:${sp.passado}` : ""}`}
      backHref="/aluno"
      backdate={backdate}
    />
  );
}
