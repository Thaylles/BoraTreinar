import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { WorkoutRunner } from "@/components/workout/workout-runner";
import { requireRole } from "@/lib/auth";
import { resolveBackdate } from "@/lib/backdate-server";
import { loadRunnerForPlan } from "@/lib/runner-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Registrar treino" };

export default async function RegistrarTreinoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; planId: string }>;
  searchParams: Promise<{ passado?: string; min?: string }>;
}) {
  const [{ id, planId }, sp] = await Promise.all([params, searchParams]);
  const { profile } = await requireRole("personal");
  // Treino esquecido (até 7 dias atrás): fora do prazo volta para a escolha.
  const backdate = resolveBackdate(sp.passado, sp.min);
  if (sp.passado && !backdate) redirect(`/personal/alunos/${id}/registrar-passado?erro=data`);
  const supabase = await createClient();
  const [{ data: student }, data] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(),
    loadRunnerForPlan(planId, id),
  ]);
  if (!student || !data || !data.exercises.length) notFound();

  return (
    <>
      <Alert kind="info" className="mb-4">
        Registrando o treino de <strong>{student.full_name}</strong>. Ficará marcado como &quot;registrado pelo instrutor&quot;.
      </Alert>
      <WorkoutRunner
        studentId={id}
        planId={planId}
        planName={data.plan.name}
        kind="ficha"
        exercises={data.exercises}
        storageKey={`bt:registro:${profile.id}:${id}:${planId}${backdate ? `:passado:${sp.passado}` : ""}`}
        backHref={`/personal/alunos/${id}`}
        loggedByInstructor
        backdate={backdate}
      />
    </>
  );
}
