import { Redirect } from "expo-router";
import { loadCatalogFor } from "@/lib/plans-server";
import { useData } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { Loading, PageTitle, Screen } from "~/ui";
import { PlanEditor } from "~/components/plan-editor";

export default function NovaFichaAluno() {
  const profile = useProfile();
  const q = useData(["catalog", profile.id], () => loadCatalogFor(profile.id));
  // Personal no "Meu treino" monta modelos na área de Personal.
  if (profile.role === "personal") return <Redirect href="/personal/modelos" />;
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]}>
      <PageTitle sub="Monte um treino para repetir quando quiser. Ele fica salvo na sua conta.">Nova ficha</PageTitle>
      <PlanEditor mode="aluno" catalog={q.data} initial={{ planId: null, studentId: profile.id, name: "", goal: "", notes: "", validUntil: "", items: [] }} />
    </Screen>
  );
}
