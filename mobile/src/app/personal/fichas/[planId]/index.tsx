import { useState } from "react";
import { View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Archive, ArchiveRestore, ClipboardList, Copy, Pencil, RefreshCw, Trash2 } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { loadPlan } from "@/lib/plans-server";
import { spDateKey } from "@/lib/week";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { useCall } from "~/lib/use-action";
import { Alert, Badge, Button, Card, EmptyState, Input, LinkButton, Loading, Screen, Text, useTheme } from "~/ui";
import { Select } from "~/ui/forms";
import { PlanExportButtons, PlanItemsList } from "~/components/plan-view";

export default function PersonalFicha() {
  const { planId, salvo, duplicada, erro, renovar } = useLocalSearchParams<{ planId: string; salvo?: string; duplicada?: string; erro?: string; renovar?: string }>();
  const profile = useProfile();
  const t = useTheme();
  const q = useData(["personal-plan", planId], async () => {
    const loaded = await loadPlan(planId);
    const [{ data: myStudents }, { data: canEdit }] = await Promise.all([
      supabase.from("personal_students").select("student:profiles!personal_students_student_id_fkey(id, full_name)").eq("personal_id", profile.id).eq("status", "ativo").is("archived_at", null),
      supabase.rpc("can_edit_plan", { p_plan: planId }),
    ]);
    return { loaded, myStudents: myStudents ?? [], canEdit: !!canEdit };
  });
  const refresh = useRefresh(q);
  const [target, setTarget] = useState("");
  const [copyName, setCopyName] = useState("");
  const renew = useCall("personal/fichas#renewPlan");
  const dup = useCall("personal/fichas#duplicatePlan");
  const archive = useCall("personal/fichas#archivePlan");
  const del = useCall("personal/fichas#deletePlan");
  if (q.isLoading) return <Loading />;
  if (!q.data?.loaded)
    return (
      <Screen edges={[]}>
        <EmptyState icon={ClipboardList} title="Ficha não encontrada" />
      </Screen>
    );
  const { loaded, myStudents, canEdit } = q.data;
  const { plan, items } = loaded;
  const others = myStudents.map((s) => s.student).filter((s): s is { id: string; full_name: string } => !!s && s.id !== plan.student_id).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  const back = plan.is_template ? "/personal/modelos" : `/personal/alunos/${plan.student_id}`;
  const today = spDateKey();
  const expired = !!plan.valid_until && plan.valid_until < today;
  const daysLeft = plan.valid_until ? Math.round((Date.parse(plan.valid_until) - Date.parse(today)) / 86_400_000) : null;
  const renewable = !plan.is_template && !plan.archived_at && ((daysLeft !== null && daysLeft <= 7) || !!renovar);
  const byStudent = !plan.is_template && !!plan.student_id && plan.created_by === plan.student_id;
  const err = erro ?? renew.error ?? dup.error ?? archive.error ?? del.error;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      {salvo ? <Alert kind="success" className="mb-4">Ficha salva! Tá pago ✅</Alert> : null}
      {duplicada ? <Alert kind="success" className="mb-4">Ficha duplicada. Esta é a cópia — ajuste o que precisar.</Alert> : null}
      {err ? <Alert className="mb-4">{err}</Alert> : null}
      <View className="mb-4">
        <View className="flex-row flex-wrap gap-2">
          {plan.is_template ? <Badge tone="yellow">Modelo</Badge> : null}
          {plan.archived_at ? <Badge>Arquivada</Badge> : null}
          {expired ? <Badge tone="red">Vencida</Badge> : null}
          {byStudent ? <Badge tone="blue">{`Criada pelo aluno${canEdit ? " · edição liberada" : ""}`}</Badge> : null}
        </View>
        <Text className="mt-1 font-display text-3xl font-extrabold leading-tight">{plan.name}</Text>
        {!plan.is_template && plan.student ? <Text className="text-sm text-muted">de {plan.student.full_name}</Text> : null}
        {plan.goal ? <Text className="text-muted">🎯 {plan.goal}</Text> : null}
        <Text className="mt-1 text-xs text-muted">
          Criada por {plan.created_by === profile.id ? "você" : (plan.creator?.full_name ?? "—")} em {formatDate(plan.created_at)}
          {plan.valid_until ? ` · válida até ${formatDate(`${plan.valid_until}T12:00:00`)}` : ""}
        </Text>
      </View>
      {renewable ? (
        <Card className="mb-4 border-2 border-ipe-500 bg-ipe-100/60 dark:bg-ipe-500/10">
          <View className="flex-row items-center gap-2">
            <RefreshCw color={t.foreground} size={20} />
            <Text className="font-display text-lg font-bold">
              {daysLeft === null ? "Renovar ficha" : expired ? "Ficha vencida" : daysLeft === 0 ? "Ficha vence hoje" : `Ficha vence em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}
            </Text>
          </View>
          <Text className="mt-1 text-sm text-muted">
            Duplique e ajuste para o próximo ciclo: abrimos a cópia no editor para você definir a nova validade
            {canEdit ? " e a ficha atual vai para as arquivadas." : ". A ficha atual, montada pelo aluno, continua ativa."}
          </Text>
          <Button className="mt-3" icon={RefreshCw} loading={renew.pending} onPress={() => renew.run(form({ plan_id: planId }))}>
            Duplicar e ajustar
          </Button>
        </Card>
      ) : null}
      {plan.notes ? (
        <Card className="mb-4">
          <Text className="text-sm">{plan.notes}</Text>
        </Card>
      ) : null}
      {!canEdit ? (
        <View className="mb-6 rounded-2xl bg-anil-700/5 px-4 py-3 dark:bg-white/5">
          <Text className="text-sm text-muted">Ficha montada pelo próprio aluno: só ele edita (o aluno pode liberar a edição para você em “Privacidade”). Para propor mudanças, duplique abaixo para o mesmo aluno e ajuste a cópia.</Text>
        </View>
      ) : (
        <LinkButton href={`/personal/fichas/${planId}/editar`} icon={Pencil} className="mb-6 self-start">
          Editar
        </LinkButton>
      )}
      <View className="mb-6">
        <PlanExportButtons planId={planId} name={plan.name} />
      </View>
      <PlanItemsList items={items} />
      <Card className="mt-8 gap-3">
        <View className="flex-row items-center gap-2">
          <Copy color={t.foreground} size={20} />
          <Text className="font-display text-lg font-bold">Duplicar</Text>
        </View>
        <Select
          value={target}
          onChange={setTarget}
          placeholder="Para onde?"
          options={[
            ...(!plan.is_template ? [{ value: "este", label: `Para ${plan.student?.full_name} (mesmo aluno)` }] : []),
            { value: "modelo", label: "Salvar como modelo" },
            ...others.map((s) => ({ value: s.id, label: s.full_name, group: "Para outro aluno" })),
          ]}
        />
        <Input value={copyName} onChangeText={setCopyName} maxLength={60} placeholder={`Nome da cópia (padrão: ${plan.name})`} />
        <Button variant="secondary" disabled={!target} loading={dup.pending} onPress={() => dup.run(form({ plan_id: planId, student_id: plan.student_id ?? "", target, name: copyName }))}>
          Duplicar ficha
        </Button>
        <Link href={`/personal/modelos/aplicar?ficha=${planId}`} className="self-center">
          <Text className="text-sm font-semibold text-bandeira-600 dark:text-bandeira-100">Duplicar para vários alunos de uma vez →</Text>
        </Link>
      </Card>
      <View className="mt-6 flex-row flex-wrap gap-3">
        {!plan.is_template ? (
          <Button variant="ghost" icon={plan.archived_at ? ArchiveRestore : Archive} loading={archive.pending} onPress={() => archive.run(form({ plan_id: planId, archived: plan.archived_at ? "0" : "1" }))}>
            {plan.archived_at ? "Reativar ficha" : "Arquivar ficha"}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          icon={Trash2}
          textClassName="text-pitanga-600"
          loading={del.pending}
          onPress={async () => {
            if (await confirmAsk("Excluir esta ficha? Os treinos já registrados continuam no histórico.", { ok: "Excluir", destructive: true })) await del.run(form({ plan_id: planId, back }));
          }}
        >
          Excluir
        </Button>
      </View>
    </Screen>
  );
}
