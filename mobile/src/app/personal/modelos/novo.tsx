import { loadCatalogFor } from "@/lib/plans-server";
import { useData } from "~/lib/data";
import { Loading, PageTitle, Screen } from "~/ui";
import { PlanEditor } from "~/components/plan-editor";

export default function NovoModelo() {
  const q = useData(["catalog", "modelo"], () => loadCatalogFor(null));
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]}>
      <PageTitle sub="Monte uma vez e aplique para vários alunos.">Novo modelo</PageTitle>
      <PlanEditor catalog={q.data} initial={{ planId: null, studentId: null, name: "", goal: "", notes: "", validUntil: "", items: [] }} />
    </Screen>
  );
}
