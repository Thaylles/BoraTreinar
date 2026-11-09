import { useMemo } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { loadRunnerForPlan } from "@/lib/runner-server";
import { resolveBackdate } from "@/lib/backdate-server";
import { RunnerScreen } from "~/components/runner-screen";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";

/** O Personal registra o treino do aluno (fica marcado como "registrado pelo instrutor"). */
export default function RegistrarTreinoDoAluno() {
  const { id, planId, passado, min } = useLocalSearchParams<{ id: string; planId: string; passado?: string; min?: string }>();
  const profile = useProfile();
  const backdate = useMemo(() => resolveBackdate(passado, min), [passado, min]);
  if (passado && !backdate) return <Redirect href={`/personal/alunos/${id}/registrar-passado?erro=data`} />;
  const qs = passado && min ? `?passado=${encodeURIComponent(passado)}&min=${encodeURIComponent(min)}` : "";
  return (
    <RunnerScreen
      queryKey={["runner-instrutor", planId, id]}
      load={async () => {
        const [{ data: student }, d] = await Promise.all([supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(), loadRunnerForPlan(planId, id)]);
        return d && student ? { name: `${d.plan.name} · ${student.full_name.split(" ")[0]}`, planId, exercises: d.exercises } : null;
      }}
      studentId={id}
      kind="ficha"
      storageKey={`bt:registro:${profile.id}:${id}:${planId}${backdate ? `:passado:${passado}` : ""}`}
      backHref={`/personal/alunos/${id}`}
      selfHref={`/personal/alunos/${id}/registrar/${planId}${qs}`}
      backdate={backdate}
      checkWeighIn={false}
      loggedByInstructor
    />
  );
}
