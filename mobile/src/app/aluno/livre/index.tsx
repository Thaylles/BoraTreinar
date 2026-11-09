import { useLocalSearchParams } from "expo-router";
import { loadCatalogFor } from "@/lib/plans-server";
import { FREE_MAX_EXERCISES } from "@/lib/runner-server";
import { backdateQuery, resolveBackdate } from "@/lib/backdate-server";
import { useData } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { Alert, Loading, PageTitle, Screen } from "~/ui";
import { FreeBuilder } from "~/components/free-builder";

export default function TreinoLivre() {
  const { passado, min } = useLocalSearchParams<{ passado?: string; min?: string }>();
  const profile = useProfile();
  const backdate = resolveBackdate(passado, min);
  const q = useData(["catalog", profile.id], () => loadCatalogFor(profile.id));
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]}>
      <PageTitle sub="Monte o treino de hoje com exercícios do catálogo. Se quiser repetir depois, salve como ficha.">Treino livre</PageTitle>
      {backdate ? <Alert kind="info" className="mb-4">{`Treino esquecido: escolha os exercícios que você fez ${backdate.label}.`}</Alert> : null}
      <FreeBuilder catalog={q.data} max={FREE_MAX_EXERCISES} canSave={profile.role !== "personal"} extraQuery={backdate ? backdateQuery(passado, min) : ""} />
    </Screen>
  );
}
