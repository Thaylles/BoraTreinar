import { useMemo } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { loadRunnerForPlan } from "@/lib/runner-server";
import { resolveBackdate } from "@/lib/backdate-server";
import { RunnerScreen } from "~/components/runner-screen";
import { useProfile } from "~/lib/session";

export default function TreinarFicha() {
  const { planId, passado, min } = useLocalSearchParams<{ planId: string; passado?: string; min?: string }>();
  const profile = useProfile();
  const backdate = useMemo(() => resolveBackdate(passado, min), [passado, min]);
  if (passado && !backdate) return <Redirect href="/aluno/registrar-passado?erro=data" />;
  const qs = passado && min ? `?passado=${encodeURIComponent(passado)}&min=${encodeURIComponent(min)}` : "";
  return (
    <RunnerScreen
      queryKey={["runner", "plan", planId, profile.id]}
      load={async () => {
        const d = await loadRunnerForPlan(planId, profile.id);
        return d && { name: d.plan.name, planId, exercises: d.exercises };
      }}
      studentId={profile.id}
      kind="ficha"
      storageKey={`bt:treino:${profile.id}:${planId}${backdate ? `:passado:${passado}` : ""}`}
      backHref="/aluno"
      selfHref={`/aluno/treinar/${planId}${qs}`}
      backdate={backdate}
    />
  );
}
