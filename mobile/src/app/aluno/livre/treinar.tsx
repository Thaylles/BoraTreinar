import { useMemo } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { FREE_MAX_EXERCISES, loadRunnerForFree } from "@/lib/runner-server";
import { resolveBackdate } from "@/lib/backdate-server";
import { RunnerScreen } from "~/components/runner-screen";
import { useProfile } from "~/lib/session";
import { queryClient } from "~/lib/query";
import type { CatalogItem } from "~/components/exercise-picker";
import type { RunnerExercise } from "~/components/workout-runner";

function offlineFree(userId: string, ids: string[]): RunnerExercise[] {
  const catalog = queryClient.getQueryData<CatalogItem[]>(["catalog", userId]) ?? [];
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is CatalogItem => !!c)
    .map((c) => ({
      equipment: { ...c, intensity_unit: c.intensity_unit ?? null },
      notes: null,
      restSeconds: c.muscle_group === "cardio" ? 0 : 60,
      targetSets: c.muscle_group === "cardio" ? 1 : 3,
      repsMin: null,
      repsMax: null,
      suggestedLoad: c.is_bodyweight ? 0 : null,
      history: { last: null, best: null },
    }));
}

export default function TreinoLivreExec() {
  const { e, passado, min } = useLocalSearchParams<{ e?: string; passado?: string; min?: string }>();
  const profile = useProfile();
  const backdate = useMemo(() => resolveBackdate(passado, min), [passado, min]);
  const ids = (e ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, FREE_MAX_EXERCISES);
  if (passado && !backdate) return <Redirect href="/aluno/registrar-passado?erro=data" />;
  if (!ids.length) return <Redirect href="/aluno/livre" />;
  const qs = `?e=${ids.join(",")}${passado && min ? `&passado=${encodeURIComponent(passado)}&min=${encodeURIComponent(min)}` : ""}`;
  return (
    <RunnerScreen
      queryKey={["runner", "free", ids.join(","), profile.id]}
      load={async () => {
        const { exercises } = await loadRunnerForFree(profile.id, ids);
        // Sem internet: monta com o catálogo salvo no aparelho (sem histórico de cargas).
        return { name: "Treino livre", planId: null, exercises: exercises.length ? exercises : offlineFree(profile.id, ids) };
      }}
      studentId={profile.id}
      kind="livre"
      storageKey={`bt:livre:${profile.id}:${ids.join(",")}${backdate ? `:passado:${passado}` : ""}`}
      backHref="/aluno"
      selfHref={`/aluno/livre/treinar${qs}`}
      backdate={backdate}
    />
  );
}
