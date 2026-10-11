import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { WorkoutRunner } from "@/components/workout/workout-runner";
import { requireRole } from "@/lib/auth";
import { loadRunnerForPlan } from "@/lib/runner-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Registrar treino" };

export default async function RegistrarTreinoPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  const { id, planId } = await params;
  const { profile } = await requireRole("personal");
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
        storageKey={`bt:registro:${profile.id}:${id}:${planId}`}
        backHref={`/personal/alunos/${id}`}
        loggedByInstructor
      />
    </>
  );
}
