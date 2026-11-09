import { View } from "react-native";
import { CalendarDays } from "lucide-react-native";
import { loadAgenda } from "@/lib/agenda-server";
import { brl, paymentStatus } from "@/lib/finance";
import { MONTHS } from "@/lib/schedule";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Badge, EmptyState, Loading, PageTitle, Screen, Text } from "~/ui";
import { OccurrenceList } from "~/components/agenda";
import { PixPay } from "~/components/pix-pay";

const STATUS = {
  pago: { label: "Pago", tone: "green" },
  atrasado: { label: "Atrasado", tone: "red" },
  hoje: { label: "Vence hoje", tone: "yellow" },
  pendente: { label: "Em aberto", tone: "neutral" },
} as const;

async function load(id: string) {
  const [agenda, { data: payments }, { data: changes }] = await Promise.all([
    loadAgenda({ studentId: id, days: 21 }),
    supabase.from("payments").select("*, personal:profiles!payments_personal_id_fkey(full_name)").eq("student_id", id).order("month", { ascending: false }).limit(6),
    supabase.from("class_change_requests").select("id, schedule_id, on_date, new_date, new_time, status, reply, answered_at").eq("student_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const open = (payments ?? []).filter((p) => !p.paid_at && Number(p.amount) > 0);
  const { data: pixRows } = open.length ? await supabase.from("pix_settings").select("*").in("personal_id", [...new Set(open.map((p) => p.personal_id))]) : { data: [] };
  return { agenda, payments: payments ?? [], changes: changes ?? [], pix: pixRows ?? [] };
}

export default function AlunoAulas() {
  const profile = useProfile();
  const q = useData(["aulas", profile.id], () => load(profile.id));
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const { agenda, payments, changes, pix } = q.data;
  const { occurrences, today } = agenda;
  const pending = new Map(changes.filter((c) => c.status === "pendente").map((c) => [`${c.schedule_id}|${c.on_date}`, c]));
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const refused = changes.filter((c) => c.status === "recusado" && (c.answered_at ?? "") >= weekAgo);
  const pixOf = new Map(pix.map((x) => [x.personal_id, x]));
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Aulas presenciais com seu Personal nas próximas 3 semanas.">Minhas aulas</PageTitle>
      {payments.length ? (
        <View className="mb-8">
          <Text className="mb-2 font-display text-xl font-bold">Pagamentos</Text>
          <View className="gap-2">
            {payments.map((p) => {
              const st = STATUS[paymentStatus({ ...p, amount: Number(p.amount) }, today)];
              return (
                <View key={p.id} className="rounded-2xl border border-border bg-surface p-3">
                  <View className="flex-row items-center gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-semibold">
                        {MONTHS[Number(p.month.slice(5, 7)) - 1]} · {p.personal?.full_name}
                      </Text>
                      <Text className="text-xs text-muted" numberOfLines={1}>
                        {p.description} · vence {p.due_on.slice(8, 10)}/{p.due_on.slice(5, 7)}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="font-bold">{brl(Number(p.amount))}</Text>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </View>
                  </View>
                  {!p.paid_at && Number(p.amount) > 0 ? <PixPay payment={{ ...p, amount: Number(p.amount) }} pix={pixOf.get(p.personal_id) ?? null} /> : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {!occurrences.length ? (
        <EmptyState icon={CalendarDays} title="Nenhuma aula agendada">
          Quando seu Personal marcar aulas presenciais, elas aparecem aqui.
        </EmptyState>
      ) : (
        <>
          {refused.map((c) => (
            <View key={c.id} className="mb-3 rounded-2xl border border-border bg-surface p-3">
              <Text className="text-sm">
                ❌ A troca da aula de {c.on_date.slice(8, 10)}/{c.on_date.slice(5, 7)} não foi aceita{c.reply ? `: “${c.reply}”` : "; a aula continua no horário de sempre."}
              </Text>
            </View>
          ))}
          <Text className="mb-3 text-sm text-muted">Precisa mudar uma aula? Toque em “Pedir troca” e escolha outro dia desta semana ou da próxima.</Text>
          <OccurrenceList occurrences={occurrences} today={today} showPersonal studentChanges={pending} />
        </>
      )}
    </Screen>
  );
}
