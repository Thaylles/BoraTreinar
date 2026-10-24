import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkoutRunner } from "@/components/workout/workout-runner";
import { WeighInGate } from "@/components/weight/weigh-in-gate";
import { requireRole } from "@/lib/auth";
import { FREE_MAX_EXERCISES, loadRunnerForFree } from "@/lib/runner-server";
import { getWeighInStatus } from "@/lib/weight-server";
import { resolveBackdate } from "@/lib/backdate-server";

export const metadata: Metadata = { title: "Treino livre" };

export default async function TreinoLivreExecPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; passado?: string; min?: string }>;
}) {
  const sp = await searchParams;
  const { profile } = await requireRole("aluno");
  const backdate = resolveBackdate(sp.passado, sp.min);
  if (sp.passado && !backdate) redirect("/aluno/registrar-passado?erro=data");
  const ids = (sp.e ?? "")
    .split(",")
    .filter((x) => /^[0-9a-f-]{36}$/i.test(x))
    .slice(0, FREE_MAX_EXERCISES);
  if (!ids.length) redirect("/aluno/livre");

  const [data, weighIn] = await Promise.all([loadRunnerForFree(profile.id, ids), getWeighInStatus(profile.id)]);
  if (!data.exercises.length) redirect("/aluno/livre");
  if (weighIn.overdue && !backdate) return <WeighInGate status={weighIn} next={`/aluno/livre/treinar?e=${ids.join(",")}`} />;

  return (
    <WorkoutRunner
      studentId={profile.id}
      planId={null}
      planName="Treino livre"
      kind="livre"
      exercises={data.exercises}
      storageKey={`bt:livre:${profile.id}:${data.exercises.map((e) => e.equipment.id).join(",")}${backdate ? `:passado:${sp.passado}` : ""}`}
      backHref="/aluno"
      backdate={backdate}
    />
  );
}
