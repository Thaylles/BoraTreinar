import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Archive, ArchiveRestore, CalendarDays, ChevronRight, ClipboardList, Lock, Mail, Phone, Plus, Scale, Users } from "lucide-react-native";
import { loadAgenda } from "@/lib/agenda-server";
import { formatDate } from "@/lib/format";
import { formatPhoneBR } from "@/lib/phone";
import { listSessions } from "@/lib/sessions-server";
import { getStudentSettings, getWeighInStatus, listWeights, shortDay } from "@/lib/weight-server";
import { daysAgoLabel, daysAgoSP, startOfWeekSP } from "@/lib/week";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { useCall, useFormAction } from "~/lib/use-action";
import { Alert, Badge, Button, Card, EmptyState, FormMessage, Loading, Screen, Text, useTheme } from "~/ui";
import { Avatar, Disclosure, WhatsAppButton } from "~/ui/extras";
import { Segmented, Select, TextField } from "~/ui/forms";
import { OccurrenceList, ScheduleForm, ScheduleRows } from "~/components/agenda";
import { TrendChart } from "~/components/charts";
import { HealthSummary } from "~/components/health-summary";
import { SessionList } from "~/components/sessions";
import { CardioGoalCard } from "~/components/widgets";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function WeightSection({ studentId }: { studentId: string }) {
  const t = useTheme();
  const q = useData(["personal-weight", studentId], async () => {
    const [settings, status, weights] = await Promise.all([getStudentSettings(studentId), getWeighInStatus(studentId), listWeights(studentId, 30)]);
    return { settings, status, weights };
  });
  if (!q.data) return null;
  const { settings, status, weights } = q.data;
  const visible = settings.weightVisible && weights.length > 0;
  const last = weights[0];
  const prev = weights[1];
  const diff = visible && prev ? last.weight_kg - prev.weight_kg : null;
  return (
    <View className="mb-6">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Scale color={t.foreground} size={20} />
          <Text className="font-display text-xl font-bold">Peso</Text>
        </View>
        {status.overdue ? <Badge tone="red">Pesagem vencida</Badge> : <Badge tone="green">Pesagem em dia</Badge>}
      </View>
      <Text className="mb-3 text-sm text-muted">
        Frequência {status.frequency}
        {status.lastMeasuredOn ? ` · última pesagem em ${shortDay(status.lastMeasuredOn)}` : " · nunca se pesou"}
      </Text>
      {!settings.weightVisible ? (
        <View className="flex-row items-center gap-2 rounded-2xl bg-border/40 p-4">
          <Lock color={t.muted} size={16} />
          <Text className="text-sm text-muted">O aluno optou por não compartilhar o peso.</Text>
        </View>
      ) : !visible ? (
        <Text className="text-sm text-muted">Nenhuma pesagem registrada ainda.</Text>
      ) : (
        <Card>
          <Text className="font-display text-3xl font-extrabold">
            {fmt(last.weight_kg)} kg
            {diff != null ? <Text className="text-base text-muted">{`  (${diff > 0 ? "+" : ""}${fmt(diff)} kg desde ${shortDay(prev.measured_on)})`}</Text> : null}
          </Text>
          <TrendChart label="Peso" emptyText="Ainda há poucas pesagens para o gráfico." points={[...weights].reverse().map((w) => ({ date: w.measured_on, value: w.weight_kg }))} />
        </Card>
      )}
    </View>
  );
}

function ClassesSection({ studentId, meId }: { studentId: string; meId: string }) {
  const t = useTheme();
  const q = useData(["student-agenda", studentId], () => loadAgenda({ studentId, days: 14 }));
  const [adding, setAdding] = useState(false);
  if (!q.data) return null;
  const { occurrences, today } = q.data;
  const schedules = q.data.schedules.filter((s) => !s.ends_on || s.ends_on >= today);
  return (
    <View className="mb-6">
      <View className="mb-2 flex-row items-center gap-2">
        <CalendarDays color={t.foreground} size={20} />
        <Text className="font-display text-xl font-bold">Aulas presenciais</Text>
      </View>
      {schedules.length ? <ScheduleRows schedules={schedules} meId={meId} /> : null}
      {schedules.length ? (
        <View className="mb-3">
          <Text className="mb-2 text-sm font-semibold">Próximos 14 dias</Text>
          <OccurrenceList occurrences={occurrences} today={today} managerId={meId} />
        </View>
      ) : null}
      <View className="rounded-3xl border border-border bg-surface p-4">
        <Pressable onPress={() => setAdding((a) => !a)}>
          <Text className="font-display font-bold">{adding ? "− Agendar aula" : "+ Agendar aula"}</Text>
        </Pressable>
        {adding ? (
          <View className="mt-4">
            <ScheduleForm studentId={studentId} today={today} onDone={() => setAdding(false)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const OPCOES = {
  compartilhamento: { title: "Compartilhar", desc: "O aluno passa a ter dois Personais. Você continua responsável e pode revogar quando quiser." },
  transferencia: { title: "Transferir", desc: "O outro Personal vira o responsável, com todo o histórico. Você perde o acesso ao aluno." },
} as const;

function TransferForm({ studentId }: { studentId: string }) {
  const [kind, setKind] = useState<keyof typeof OPCOES>("compartilhamento");
  const [email, setEmail] = useState("");
  const { state, pending, submit } = useFormAction("personal#requestTransfer");
  return (
    <View className="gap-4">
      <Segmented options={[{ value: "compartilhamento", label: "Compartilhar" }, { value: "transferencia", label: "Transferir" }]} value={kind} onChange={(k) => setKind(k as typeof kind)} />
      <Text className="text-sm text-muted">{OPCOES[kind].desc}</Text>
      <TextField label="E-mail do outro Personal" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" hint="Ele precisa ter conta de Personal no BoraTreinar e aceitar o pedido." />
      <FormMessage state={state} />
      <Button
        variant={kind === "transferencia" ? "danger" : "primary"}
        loading={pending}
        onPress={async () => {
          if (kind === "transferencia" && !(await confirmAsk("Depois que o outro Personal aceitar, você perde o acesso a este aluno. Continuar?", { destructive: true }))) return;
          await submit({ student_id: studentId, kind, email });
        }}
      >
        {`Enviar pedido de ${OPCOES[kind].title.toLowerCase()}`}
      </Button>
    </View>
  );
}

export default function PersonalAluno() {
  const { id, erro } = useLocalSearchParams<{ id: string; erro?: string }>();
  const me = useProfile();
  const t = useTheme();
  const q = useData(["personal-aluno", id], async () => {
    const [{ data: student }, { data: links }, { data: transfers }, { data: plans }, { data: templates }, sessions] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).in("role", ["aluno", "admin"]).maybeSingle(),
      supabase.from("personal_students").select("personal_id, role, archived_at, created_at, personal:profiles!personal_students_personal_id_fkey(full_name, email)").eq("student_id", id).eq("status", "ativo"),
      supabase.from("student_transfers").select("id, kind, created_at, to:profiles!student_transfers_to_personal_id_fkey(full_name)").eq("student_id", id).eq("from_personal_id", me.id).eq("status", "pendente"),
      supabase.from("workout_plans").select("id, name, goal, valid_until, archived_at, created_by, creator:profiles!workout_plans_created_by_fkey(full_name), items:workout_plan_items(count)").eq("student_id", id).order("name"),
      supabase.from("workout_plans").select("id, name").eq("is_template", true).eq("created_by", me.id).order("name"),
      listSessions(id, 10),
    ]);
    return { student, links: links ?? [], transfers: transfers ?? [], plans: plans ?? [], templates: templates ?? [], sessions };
  });
  const refresh = useRefresh(q);
  const [template, setTemplate] = useState("");
  const apply = useCall("personal/fichas#applyTemplate");
  const revoke = useCall("personal#revokeShare");
  const cancelT = useCall("personal#cancelTransfer");
  const archive = useCall("personal#setArchived");
  if (q.isLoading) return <Loading />;
  const d = q.data;
  const myLink = d?.links.find((l) => l.personal_id === me.id);
  if (!d?.student || !myLink)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Users} title="Aluno não encontrado" />
      </Screen>
    );
  const { student, links, transfers, plans, templates, sessions } = d;
  const iAmResponsible = myLink.role === "responsavel";
  const weekStart = startOfWeekSP();
  const thisWeek = sessions.filter((s) => s.started_at >= weekStart);
  const activePlans = plans.filter((p) => !p.archived_at);
  const archivedPlans = plans.filter((p) => p.archived_at);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <View className="mb-6 flex-row items-center gap-4">
        <Avatar path={student.avatar_path} name={student.full_name} size={64} />
        <View className="min-w-0 flex-1">
          <Text className="font-display text-2xl font-extrabold leading-tight">{student.full_name}</Text>
          <View className="mt-1 flex-row flex-wrap gap-2">
            {iAmResponsible ? <Badge tone="green">Você é o responsável</Badge> : <Badge tone="blue">Compartilhado com você</Badge>}
            {myLink.archived_at ? <Badge>Arquivado</Badge> : null}
          </View>
        </View>
      </View>
      <WhatsAppButton phone={student.phone} className="mb-4" />
      {erro || apply.error ? <Alert className="mb-4">{erro ?? apply.error ?? ""}</Alert> : null}
      <HealthSummary studentId={id} />

      <View className="mb-6">
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Text className="font-display text-xl font-bold">Fichas</Text>
          <Link href={`/personal/alunos/${id}/fichas/nova`} asChild>
            <Pressable className="flex-row items-center gap-1 rounded-xl bg-bandeira-500 px-3 py-1.5">
              <Plus color="#fff" size={16} />
              <Text className="font-display text-sm font-bold text-white">Nova ficha</Text>
            </Pressable>
          </Link>
        </View>
        {!activePlans.length ? (
          <View className="flex-row items-center gap-3 rounded-3xl border-2 border-dashed border-border p-4">
            <ClipboardList color={t.bandeira500} size={24} />
            <Text className="flex-1 text-sm text-muted">Nenhuma ficha ainda. Monte a primeira ou aplique um modelo.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {activePlans.map((p) => (
              <Link key={p.id} href={`/personal/fichas/${p.id}`} asChild>
                <Pressable>
                  <Card className="flex-row items-center gap-3 p-4">
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold">{p.name}</Text>
                      <Text className="text-xs text-muted">
                        {p.items[0]?.count ?? 0} exercícios{p.goal ? ` · ${p.goal}` : ""} · por {p.created_by === me.id ? "você" : p.created_by === id ? "o próprio aluno" : (p.creator?.full_name ?? "—")}
                      </Text>
                    </View>
                    {p.valid_until && p.valid_until < today ? <Badge tone="red">Vencida</Badge> : null}
                    <ChevronRight color={t.muted} size={20} />
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
        {archivedPlans.length ? (
          <View className="mt-2">
            <Disclosure label={`${archivedPlans.length} ficha(s) arquivada(s)`}>
              {archivedPlans.map((p) => (
                <Link key={p.id} href={`/personal/fichas/${p.id}`} className="mt-1 pl-4">
                  <Text className="text-sm underline">{p.name}</Text>
                </Link>
              ))}
            </Disclosure>
          </View>
        ) : null}
        {templates.length ? (
          <View className="mt-3 flex-row items-center gap-2">
            <View className="flex-1">
              <Select value={template} onChange={setTemplate} placeholder="Aplicar um modelo…" options={templates.map((x) => ({ value: x.id, label: x.name }))} />
            </View>
            <Button variant="secondary" size="sm" disabled={!template} loading={apply.pending} onPress={() => apply.run(form({ student_id: id, template_id: template }))}>
              Aplicar
            </Button>
          </View>
        ) : null}
      </View>

      <View className="mb-6">
        <View className="mb-1 flex-row flex-wrap items-center justify-between gap-2">
          <Text className="font-display text-xl font-bold">Treinos</Text>
          <View className="flex-row gap-2">
            <Link href={`/personal/alunos/${id}/conquistas`} asChild>
              <Pressable className="rounded-xl bg-ipe-100 px-3 py-1.5 dark:bg-ipe-500/20">
                <Text className="text-sm font-bold text-anil-900 dark:text-ipe-400">🏆 Conquistas</Text>
              </Pressable>
            </Link>
            <Link href={`/personal/alunos/${id}/evolucao`} asChild>
              <Pressable className="rounded-xl bg-bandeira-50 px-3 py-1.5 dark:bg-bandeira-500/20">
                <Text className="text-sm font-bold text-bandeira-700 dark:text-bandeira-100">📈 Ver evolução</Text>
              </Pressable>
            </Link>
          </View>
        </View>
        <Text className="mb-3 text-sm text-muted">
          <Text className="text-sm font-bold">{thisWeek.length}</Text> nesta semana (seg–dom)
          {sessions[0] ? ` · último ${daysAgoLabel(daysAgoSP(sessions[0].started_at))}` : ""}
        </Text>
        {activePlans.length ? (
          <View className="mb-3 flex-row flex-wrap gap-2">
            {activePlans.map((p) => (
              <Link key={p.id} href={`/personal/alunos/${id}/registrar/${p.id}`} asChild>
                <Pressable className="rounded-xl border border-border bg-surface px-3 py-1.5">
                  <Text className="text-sm font-semibold">✍️ Registrar {p.name}</Text>
                </Pressable>
              </Link>
            ))}
            <Link href={`/personal/alunos/${id}/registrar-passado`} asChild>
              <Pressable className="rounded-xl border border-dashed border-bandeira-500/60 px-3 py-1.5">
                <Text className="text-sm font-semibold text-bandeira-700 dark:text-bandeira-100">📅 Treino esquecido</Text>
              </Pressable>
            </Link>
          </View>
        ) : null}
        {sessions.length ? <SessionList sessions={sessions} href={(sid) => `/personal/treinos/${sid}`} /> : <Text className="text-sm text-muted">Nenhum treino registrado ainda.</Text>}
      </View>

      <ClassesSection studentId={id} meId={me.id} />
      <CardioGoalCard studentId={id} canEdit audience="personal" />
      <WeightSection studentId={id} />

      <Card className="mb-4 gap-2">
        <View className="flex-row items-center gap-2">
          <Phone color={t.muted} size={16} />
          <Text className="text-sm">{formatPhoneBR(student.phone) || "Sem telefone"}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Mail color={t.muted} size={16} />
          <Text className="flex-1 text-sm">{student.email}</Text>
        </View>
        {student.birth_date ? <Text className="text-sm text-muted">Nascimento: {formatDate(`${student.birth_date}T12:00:00`)}</Text> : null}
        <Text className="text-sm text-muted">Aluno desde {formatDate(myLink.created_at)}</Text>
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 font-display text-lg font-bold">Personais deste aluno</Text>
        <View className="gap-2">
          {links.map((l) => (
            <View key={l.personal_id} className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm">
                <Text className="text-sm font-semibold">{l.personal?.full_name}</Text>
                <Text className="text-sm text-muted"> · {l.role === "responsavel" ? "responsável" : "compartilhado"}</Text>
              </Text>
              {iAmResponsible && l.role === "compartilhado" ? (
                <Pressable onPress={async () => (await confirmAsk(`Revogar o acesso de ${l.personal?.full_name}?`, { destructive: true })) && revoke.run(form({ student_id: id, personal_id: l.personal_id }))} className="rounded-xl px-2 py-1">
                  <Text className="text-sm font-semibold text-pitanga-600">Revogar</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
        {transfers.length ? (
          <View className="mt-4 gap-2 border-t border-border pt-4">
            <Text className="text-sm font-semibold">Pedidos aguardando resposta</Text>
            {transfers.map((tr) => (
              <View key={tr.id} className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm">
                  {tr.kind === "compartilhamento" ? "Compartilhar" : "Transferir"} com <Text className="text-sm font-bold">{tr.to?.full_name}</Text>
                </Text>
                <Pressable onPress={() => cancelT.run(form({ id: tr.id }))} className="rounded-xl px-2 py-1">
                  <Text className="text-sm font-semibold text-muted">Cancelar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
      {iAmResponsible ? (
        <Card className="mb-4">
          <Text className="mb-3 font-display text-lg font-bold">Compartilhar ou transferir</Text>
          <TransferForm studentId={id} />
        </Card>
      ) : null}
      <Button variant="ghost" className="mt-6 self-start" icon={myLink.archived_at ? ArchiveRestore : Archive} loading={archive.pending} onPress={() => archive.run(form({ student_id: id, archived: myLink.archived_at ? "0" : "1" }))}>
        {myLink.archived_at ? "Reativar aluno" : "Arquivar aluno"}
      </Button>
    </Screen>
  );
}
