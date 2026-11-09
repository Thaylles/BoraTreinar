import { useState } from "react";
import { Pressable, View } from "react-native";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Package, RotateCcw, Trash2, Wallet } from "lucide-react-native";
import { loadAgenda } from "@/lib/agenda-server";
import { brl, classesPerMonth, paymentStatus, pricePerClass, type PaymentStatus } from "@/lib/finance";
import { firstName } from "@/lib/format";
import { formatPixKey } from "@/lib/pix";
import { addMonths, MONTHS } from "@/lib/schedule";
import { spDateKey } from "@/lib/week";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { useCall } from "~/lib/use-action";
import { Badge, Button, Card, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Avatar, Disclosure, WhatsAppButton } from "~/ui/extras";
import { AmountForm, BillingForm, PackageForm, PixForm } from "~/components/finance-forms";

const STATUS: Record<PaymentStatus, { label: string; tone: "green" | "red" | "yellow" | "neutral" }> = {
  pago: { label: "Pago", tone: "green" },
  atrasado: { label: "Atrasado", tone: "red" },
  hoje: { label: "Vence hoje", tone: "yellow" },
  pendente: { label: "Em aberto", tone: "neutral" },
};
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function Financeiro() {
  const profile = useProfile();
  const t = useTheme();
  const today = spDateKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const monthStart = `${month}-01`;
  const nextMonth = addMonths(month, 1);
  const q = useData(["financeiro", profile.id, month], async () => {
    const days = Math.round((Date.parse(`${nextMonth}-01`) - Date.parse(monthStart)) / 86_400_000);
    await supabase.rpc("ensure_month_charges", { p_month: monthStart });
    const [{ data: payments }, { data: billings }, { data: packages }, { data: links }, { occurrences }, { data: pix }] = await Promise.all([
      supabase.from("payments").select("*, student:profiles!payments_student_id_fkey(id, full_name, phone, avatar_path)").eq("personal_id", profile.id).eq("month", monthStart).order("due_on"),
      supabase.from("student_billing").select("*").eq("personal_id", profile.id),
      supabase.from("payment_packages").select("*").eq("personal_id", profile.id).order("kind").order("price"),
      supabase.from("personal_students").select("student:profiles!personal_students_student_id_fkey(id, full_name, avatar_path)").eq("personal_id", profile.id).eq("status", "ativo").is("archived_at", null),
      loadAgenda({ personalId: profile.id, from: monthStart, days }),
      supabase.from("pix_settings").select("*").eq("personal_id", profile.id).maybeSingle(),
    ]);
    return { payments: payments ?? [], billings: billings ?? [], packages: packages ?? [], links: links ?? [], occurrences, pix: pix ?? null };
  }, { placeholderData: (p) => p });
  const refresh = useRefresh(q);
  const toggle = useCall("personal/financeiro#togglePaid");
  const reject = useCall("personal/financeiro#rejectPaymentReport");
  const removePix = useCall("personal/financeiro#removePix");
  const removeBilling = useCall("personal/financeiro#removeBilling");
  const delPkg = useCall("personal/financeiro#deletePackage");
  const suggested = useCall("personal/financeiro#createSuggestedPackages");
  if (!q.data) return <Loading />;
  const { payments: list, billings, packages, links, occurrences, pix } = q.data;
  const total = list.reduce((s, p) => s + Number(p.amount), 0);
  const received = list.filter((p) => p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
  const late = list.filter((p) => paymentStatus({ ...p, amount: Number(p.amount) }, today) === "atrasado").reduce((s, p) => s + Number(p.amount), 0);
  const classes = occurrences.filter((o) => !o.cancelled && o.date.startsWith(month)).length;
  const students = links.map((l) => l.student).filter((s): s is { id: string; full_name: string; avatar_path: string | null } => !!s).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  const billingOf = new Map(billings.map((b) => [b.student_id, b]));
  const pkgs = packages.map((p) => ({ ...p, price: Number(p.price) }));
  const monthLower = MONTHS[Number(month.slice(5, 7)) - 1].toLowerCase();
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Pacotes, planos dos alunos, quem pagou e o faturamento do mês.">Financeiro</PageTitle>
      <Card className="mb-6 p-4">
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Pressable onPress={() => setMonth(addMonths(month, -1))} className="rounded-xl p-2" accessibilityLabel="Mês anterior">
            <ChevronLeft color={t.foreground} size={20} />
          </Pressable>
          <Text className="font-display text-xl font-bold">
            {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
          </Text>
          <Pressable onPress={() => setMonth(nextMonth)} className="rounded-xl p-2" accessibilityLabel="Próximo mês">
            <ChevronRight color={t.foreground} size={20} />
          </Pressable>
        </View>
        <Text className="text-sm text-muted">Faturamento do mês</Text>
        <Text className="font-display text-4xl font-extrabold">{brl(total)}</Text>
        <View className="mt-3 flex-row gap-2">
          <View className="flex-1 rounded-2xl bg-bandeira-50 p-3 dark:bg-bandeira-500/15">
            <Text className="text-xs text-muted">Recebido</Text>
            <Text className="font-bold text-bandeira-700 dark:text-bandeira-100">{brl(received)}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-ipe-100 p-3 dark:bg-ipe-500/15">
            <Text className="text-xs text-muted">A receber</Text>
            <Text className="font-bold">{brl(total - received)}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-pitanga-100 p-3 dark:bg-pitanga-500/15">
            <Text className="text-xs text-muted">Atrasado</Text>
            <Text className="font-bold text-pitanga-600">{brl(late)}</Text>
          </View>
        </View>
        <Text className="mt-3 text-sm text-muted">
          {classes} {classes === 1 ? "aula" : "aulas"} na agenda
          {classes > 0 && total > 0 ? (
            <>
              {" "}· média de <Text className="text-sm font-bold">{brl(total / classes)}</Text> por aula
            </>
          ) : null}
        </Text>
      </Card>

      <View className="mb-8">
        <Text className="mb-2 font-display text-xl font-bold">Pagamentos de {monthLower}</Text>
        {!list.length ? (
          <Text className="text-sm text-muted">Nenhuma cobrança neste mês. Defina o plano de cada aluno em Planos dos alunos (abaixo).</Text>
        ) : (
          <View className="gap-2">
            {list.map((p) => {
              const st = paymentStatus({ ...p, amount: Number(p.amount) }, today);
              const name = p.student?.full_name ?? "Aluno";
              return (
                <View key={p.id} className={cn("rounded-2xl border border-border bg-surface p-3", st === "pago" && "opacity-75")}>
                  <View className="flex-row items-center gap-3">
                    <Avatar path={p.student?.avatar_path} name={name} size={40} />
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold" numberOfLines={1}>{name}</Text>
                      <Text className="text-xs text-muted" numberOfLines={1}>
                        {p.description} · vence {ddmm(p.due_on)}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="font-bold">{brl(Number(p.amount))}</Text>
                      <Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge>
                    </View>
                  </View>
                  {!p.paid_at && p.reported_paid_at ? (
                    <View className="mt-2 rounded-xl bg-ipe-100 px-3 py-2 dark:bg-ipe-500/15">
                      <Text className="text-sm font-semibold">💸 {firstName(name)} avisou que pagou em {ddmm(spDateKey(p.reported_paid_at))}. Confira no banco e confirme.</Text>
                    </View>
                  ) : null}
                  <View className="mt-2 flex-row flex-wrap items-center gap-2">
                    {p.paid_at ? (
                      <Button size="sm" variant="ghost" icon={RotateCcw} onPress={async () => (await confirmAsk(`Desmarcar o pagamento de ${firstName(name)}?`)) && toggle.run(form({ id: p.id, paid: "0" }))}>
                        Desfazer
                      </Button>
                    ) : (
                      <Button size="sm" icon={CheckCircle2} loading={toggle.pending} onPress={() => toggle.run(form({ id: p.id, paid: "1" }))}>
                        {p.reported_paid_at ? "Confirmar recebimento" : "Marcar como pago"}
                      </Button>
                    )}
                    {!p.paid_at && p.reported_paid_at ? (
                      <Button size="sm" variant="ghost" textClassName="text-pitanga-600" onPress={async () => (await confirmAsk(`Avisar ${firstName(name)} que o pagamento não foi encontrado?`)) && reject.run(form({ id: p.id }))}>
                        Não recebi
                      </Button>
                    ) : null}
                    {!p.paid_at ? (
                      <WhatsAppButton
                        phone={p.student?.phone}
                        label="Cobrar"
                        className="px-3 py-1.5"
                        text={`Oi, ${firstName(name)}! Tudo bem? Passando para lembrar do pagamento das aulas de ${monthLower}: ${brl(Number(p.amount))}, com vencimento em ${ddmm(p.due_on)}. Obrigado! 💪`}
                      />
                    ) : null}
                  </View>
                  {!p.paid_at ? (
                    <View className="mt-2">
                      <Disclosure label="Ajustar valor">
                        <AmountForm id={p.id} amount={Number(p.amount)} />
                      </Disclosure>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View className="mb-8">
        <Text className="mb-1 font-display text-xl font-bold">💠 Receber por Pix</Text>
        <Text className="mb-3 text-sm text-muted">Com a sua chave, cada cobrança mostra ao aluno um QR Code e o Pix copia e cola já com o valor. O dinheiro cai direto na sua conta; quando o aluno avisar &quot;Já paguei&quot;, é só conferir e confirmar.</Text>
        <Card className="p-4">
          <Disclosure label={pix ? `Chave ${formatPixKey(pix.key_type, pix.pix_key)} · ${pix.holder_name}` : "Cadastrar chave Pix"}>
            <View className="mt-3">
              <PixForm current={pix} defaultName={profile.full_name} />
              {pix ? (
                <Pressable className="mt-3" onPress={async () => (await confirmAsk("Remover sua chave Pix? Os alunos deixam de ver o QR Code.", { destructive: true })) && removePix.run()}>
                  <Text className="text-xs font-semibold text-pitanga-600">Remover Pix</Text>
                </Pressable>
              ) : null}
            </View>
          </Disclosure>
        </Card>
      </View>

      <View className="mb-8">
        <Text className="mb-1 font-display text-xl font-bold">Planos dos alunos</Text>
        <Text className="mb-3 text-sm text-muted">Escolha o pacote e o dia do pagamento de cada aluno. A cobrança de cada mês é criada sozinha.</Text>
        {!students.length ? (
          <Text className="text-sm text-muted">Nenhum aluno ativo.</Text>
        ) : (
          <View className="gap-2">
            {students.map((s) => {
              const b = billingOf.get(s.id);
              return (
                <View key={s.id} className="rounded-2xl border border-border bg-surface p-3">
                  <View className="mb-1 flex-row items-center gap-3">
                    <Avatar path={s.avatar_path} name={s.full_name} size={36} />
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold" numberOfLines={1}>{s.full_name}</Text>
                      <Text className="text-xs text-muted" numberOfLines={1}>
                        {b ? `${b.label} · ${b.kind === "mensal" ? `${brl(Number(b.amount))}/mês` : `${brl(Number(b.amount))} por aula`} · dia ${b.due_day}` : "Sem plano definido"}
                      </Text>
                    </View>
                    {!b ? <Badge tone="yellow">Definir</Badge> : null}
                  </View>
                  <Disclosure label={b ? "Alterar plano" : "Definir plano"}>
                    <View className="mt-3 border-t border-border pt-3">
                      <BillingForm studentId={s.id} packages={pkgs} current={b ? { package_id: b.package_id, label: b.label, kind: b.kind, amount: Number(b.amount), due_day: b.due_day } : null} />
                      {b ? (
                        <Pressable className="mt-2" onPress={async () => (await confirmAsk(`Tirar o plano de ${firstName(s.full_name)}? As cobranças em aberto deste mês em diante são apagadas.`, { destructive: true })) && removeBilling.run(form({ student_id: s.id }))}>
                          <Text className="text-xs font-semibold text-pitanga-600">Tirar plano</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Disclosure>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View>
        <View className="mb-1 flex-row items-center gap-2">
          <Package color={t.bandeira500} size={20} />
          <Text className="font-display text-xl font-bold">Pacotes</Text>
        </View>
        <Text className="mb-3 text-sm text-muted">Seus preços. O valor por aula dos mensais considera ≈ 4,33 semanas no mês.</Text>
        {pkgs.length ? (
          <View className="mb-4 gap-2">
            {pkgs.map((p) => (
              <View key={p.id} className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <CircleDollarSign color={t.bandeira500} size={24} />
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold" numberOfLines={1}>{p.name}</Text>
                  <Text className="text-xs text-muted">{p.kind === "mensal" && p.classes_per_week ? `${brl(p.price)}/mês · ≈ ${classesPerMonth(p.classes_per_week)} aulas/mês` : "Cobrado por aula dada"}</Text>
                </View>
                <View className="items-end">
                  <Text className="font-bold">{brl(pricePerClass(p))}</Text>
                  <Text className="text-[11px] text-muted">por aula</Text>
                </View>
                <Pressable accessibilityLabel="Excluir pacote" className="rounded-xl p-2" onPress={async () => (await confirmAsk(`Excluir o pacote "${p.name}"? Os alunos que usam ele mantêm o valor atual.`, { destructive: true })) && delPkg.run(form({ id: p.id }))}>
                  <Trash2 color={t.muted} size={16} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View className="mb-4 rounded-2xl border-2 border-dashed border-border p-4">
            <View className="mb-2 flex-row items-center gap-2">
              <Wallet color={t.foreground} size={16} />
              <Text className="text-sm font-semibold">Comece com pacotes sugeridos</Text>
            </View>
            <Text className="mb-3 text-sm text-muted">Diária R$ 50 · 1x/semana R$ 200 · 2x/semana R$ 350 · 3x/semana R$ 480. Você pode excluir e criar os seus.</Text>
            <Button size="sm" variant="secondary" className="self-start" loading={suggested.pending} onPress={() => suggested.run()}>
              Usar sugeridos
            </Button>
          </View>
        )}
        <Card className="p-4">
          <Disclosure label="+ Novo pacote">
            <View className="mt-3">
              <PackageForm />
            </View>
          </Disclosure>
        </Card>
      </View>
    </Screen>
  );
}
