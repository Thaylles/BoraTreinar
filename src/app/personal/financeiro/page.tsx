import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Package, RotateCcw, Trash2, Wallet } from "lucide-react";
import { Badge, PageTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Avatar } from "@/components/avatar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { PackageForm } from "@/components/finance/package-form";
import { BillingForm } from "@/components/finance/billing-form";
import { AmountForm } from "@/components/finance/amount-form";
import { PixForm, type PixSettings } from "@/components/finance/pix-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadAgenda } from "@/lib/agenda-server";
import { spDateKey } from "@/lib/week";
import { addMonths, MONTHS } from "@/lib/schedule";
import { brl, classesPerMonth, paymentStatus, pricePerClass, type PaymentStatus } from "@/lib/finance";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { formatPixKey } from "@/lib/pix";
import { createSuggestedPackages, deletePackage, rejectPaymentReport, removeBilling, removePix, togglePaid } from "./actions";

export const metadata: Metadata = { title: "Financeiro" };

const STATUS: Record<PaymentStatus, { label: string; tone: "green" | "red" | "yellow" | "neutral" }> = {
  pago: { label: "Pago", tone: "green" },
  atrasado: { label: "Atrasado", tone: "red" },
  hoje: { label: "Vence hoje", tone: "yellow" },
  pendente: { label: "Em aberto", tone: "neutral" },
};

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { profile } = await requireRole("personal");
  const sp = await searchParams;
  const today = spDateKey();
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : today.slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonth = addMonths(month, 1);
  const days = Math.round((Date.parse(`${nextMonth}-01`) - Date.parse(monthStart)) / 86_400_000);

  const supabase = await createClient();
  // Cria as cobranças do mês que ainda não existem (alunos com plano).
  await supabase.rpc("ensure_month_charges", { p_month: monthStart });

  const [{ data: payments }, { data: billings }, { data: packages }, { data: links }, { occurrences }, { data: pixRow }] = await Promise.all([
    supabase
      .from("payments")
      .select("*, student:profiles!payments_student_id_fkey(id, full_name, phone, avatar_path)")
      .eq("personal_id", profile.id)
      .eq("month", monthStart)
      .order("due_on"),
    supabase.from("student_billing").select("*").eq("personal_id", profile.id),
    supabase.from("payment_packages").select("*").eq("personal_id", profile.id).order("kind").order("price"),
    supabase
      .from("personal_students")
      .select("student:profiles!personal_students_student_id_fkey(id, full_name, avatar_path)")
      .eq("personal_id", profile.id)
      .eq("status", "ativo")
      .is("archived_at", null),
    loadAgenda({ personalId: profile.id, from: monthStart, days }),
    supabase.from("pix_settings").select("*").eq("personal_id", profile.id).maybeSingle(),
  ]);
  const pix: PixSettings | null = pixRow ?? null;

  const list = payments ?? [];
  const total = list.reduce((s, p) => s + Number(p.amount), 0);
  const received = list.filter((p) => p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
  const late = list.filter((p) => paymentStatus(p, today) === "atrasado").reduce((s, p) => s + Number(p.amount), 0);
  const classes = occurrences.filter((o) => !o.cancelled && o.date.startsWith(month)).length;
  const students = (links ?? [])
    .map((l) => l.student)
    .filter((s): s is { id: string; full_name: string; avatar_path: string | null } => !!s)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  const billingOf = new Map((billings ?? []).map((b) => [b.student_id, b]));
  const pkgs = packages ?? [];
  const monthName = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

  return (
    <>
      <PageTitle sub="Pacotes, planos dos alunos, quem pagou e o faturamento do mês.">Financeiro</PageTitle>

      <section aria-label="Resumo do mês" className="mb-6 rounded-3xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link href={`/personal/financeiro?mes=${addMonths(month, -1)}`} className="rounded-xl p-2 hover:bg-border/50" aria-label="Mês anterior">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h2 className="font-display text-xl font-bold">{monthName}</h2>
          <Link href={`/personal/financeiro?mes=${nextMonth}`} className="rounded-xl p-2 hover:bg-border/50" aria-label="Próximo mês">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
        <p className="text-sm text-muted">Faturamento do mês</p>
        <p className="font-display text-4xl font-extrabold tabular-nums">{brl(total)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-2xl bg-bandeira-50 p-3 dark:bg-bandeira-500/15">
            <p className="text-xs text-muted">Recebido</p>
            <p className="font-bold tabular-nums text-bandeira-700 dark:text-bandeira-100">{brl(received)}</p>
          </div>
          <div className="rounded-2xl bg-ipe-100 p-3 dark:bg-ipe-500/15">
            <p className="text-xs text-muted">A receber</p>
            <p className="font-bold tabular-nums">{brl(total - received)}</p>
          </div>
          <div className="rounded-2xl bg-pitanga-100 p-3 dark:bg-pitanga-500/15">
            <p className="text-xs text-muted">Atrasado</p>
            <p className="font-bold tabular-nums text-pitanga-600">{brl(late)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {classes} {classes === 1 ? "aula" : "aulas"} na agenda
          {classes > 0 && total > 0 && <> · média de <strong className="text-foreground">{brl(total / classes)}</strong> por aula</>}
        </p>
      </section>

      <section aria-labelledby="cobrancas" className="mb-8">
        <h2 id="cobrancas" className="mb-2 font-display text-xl font-bold">
          Pagamentos de {MONTHS[Number(month.slice(5, 7)) - 1].toLowerCase()}
        </h2>
        {!list.length ? (
          <p className="text-sm text-muted">
            Nenhuma cobrança neste mês. Defina o plano de cada aluno em <a href="#planos" className="font-semibold underline">Planos dos alunos</a>.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => {
              const st = paymentStatus(p, today);
              const name = p.student?.full_name ?? "Aluno";
              return (
                <li key={p.id} className={cn("rounded-2xl border border-border bg-surface p-3", st === "pago" && "opacity-75")}>
                  <div className="flex items-center gap-3">
                    <Avatar path={p.student?.avatar_path} name={name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{name}</p>
                      <p className="truncate text-xs text-muted">
                        {p.description} · vence {ddmm(p.due_on)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{brl(Number(p.amount))}</p>
                      <Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge>
                    </div>
                  </div>
                  {!p.paid_at && p.reported_paid_at && (
                    <p className="mt-2 rounded-xl bg-ipe-100 px-3 py-2 text-sm font-semibold dark:bg-ipe-500/15">
                      💸 {firstName(name)} avisou que pagou em {ddmm(spDateKey(p.reported_paid_at))}. Confira no banco e confirme.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={togglePaid}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="paid" value={p.paid_at ? "0" : "1"} />
                      {p.paid_at ? (
                        <ConfirmSubmit message={`Desmarcar o pagamento de ${firstName(name)}?`} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold text-muted hover:bg-border/50">
                          <RotateCcw className="size-4" aria-hidden /> Desfazer
                        </ConfirmSubmit>
                      ) : (
                        <Button size="sm">
                          <CheckCircle2 className="size-4" aria-hidden /> {p.reported_paid_at ? "Confirmar recebimento" : "Marcar como pago"}
                        </Button>
                      )}
                    </form>
                    {!p.paid_at && p.reported_paid_at && (
                      <form action={rejectPaymentReport}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmSubmit
                          message={`Avisar ${firstName(name)} que o pagamento não foi encontrado?`}
                          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15"
                        >
                          Não recebi
                        </ConfirmSubmit>
                      </form>
                    )}
                    {!p.paid_at && (
                      <WhatsAppButton
                        phone={p.student?.phone}
                        label="Cobrar"
                        className="px-3 py-1.5 text-sm"
                        text={`Oi, ${firstName(name)}! Tudo bem? Passando para lembrar do pagamento das aulas de ${MONTHS[Number(month.slice(5, 7)) - 1].toLowerCase()}: ${brl(Number(p.amount))}, com vencimento em ${ddmm(p.due_on)}. Obrigado! 💪`}
                      />
                    )}
                    {!p.paid_at && (
                      <details className="w-full text-sm">
                        <summary className="cursor-pointer text-xs font-semibold text-muted">Ajustar valor</summary>
                        <AmountForm id={p.id} amount={Number(p.amount)} />
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="pix" aria-labelledby="pix-h" className="mb-8 scroll-mt-20">
        <h2 id="pix-h" className="mb-1 font-display text-xl font-bold">
          💠 Receber por Pix
        </h2>
        <p className="mb-3 text-sm text-muted">
          Com a sua chave, cada cobrança mostra ao aluno um QR Code e o Pix copia e cola já com o valor. O dinheiro cai direto na sua
          conta; quando o aluno avisar &quot;Já paguei&quot;, é só conferir e confirmar.
        </p>
        <details className="rounded-2xl border border-border bg-surface p-4" open={!pix}>
          <summary className="cursor-pointer font-display font-bold">
            {pix ? `Chave ${formatPixKey(pix.key_type, pix.pix_key)} · ${pix.holder_name}` : "Cadastrar chave Pix"}
          </summary>
          <div className="mt-3">
            <PixForm current={pix} defaultName={profile.full_name} />
            {pix && (
              <form action={removePix} className="mt-2">
                <ConfirmSubmit message="Remover sua chave Pix? Os alunos deixam de ver o QR Code." className="text-xs font-semibold text-pitanga-600 hover:underline">
                  Remover Pix
                </ConfirmSubmit>
              </form>
            )}
          </div>
        </details>
      </section>

      <section id="planos" aria-labelledby="planos-h" className="mb-8 scroll-mt-20">
        <h2 id="planos-h" className="mb-1 font-display text-xl font-bold">
          Planos dos alunos
        </h2>
        <p className="mb-3 text-sm text-muted">Escolha o pacote e o dia do pagamento de cada aluno. A cobrança de cada mês é criada sozinha.</p>
        {!students.length ? (
          <p className="text-sm text-muted">Nenhum aluno ativo.</p>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => {
              const b = billingOf.get(s.id);
              return (
                <li key={s.id}>
                  <details className="rounded-2xl border border-border bg-surface p-3">
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <Avatar path={s.avatar_path} name={s.full_name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{s.full_name}</span>
                        <span className="block truncate text-xs text-muted">
                          {b
                            ? `${b.label} · ${b.kind === "mensal" ? `${brl(Number(b.amount))}/mês` : `${brl(Number(b.amount))} por aula`} · dia ${b.due_day}`
                            : "Sem plano definido"}
                        </span>
                      </span>
                      {!b && <Badge tone="yellow">Definir</Badge>}
                    </summary>
                    <div className="mt-3 border-t border-border pt-3">
                      <BillingForm
                        studentId={s.id}
                        packages={pkgs}
                        current={b ? { package_id: b.package_id, label: b.label, kind: b.kind, amount: Number(b.amount), due_day: b.due_day } : null}
                      />
                      {b && (
                        <form action={removeBilling} className="mt-2">
                          <input type="hidden" name="student_id" value={s.id} />
                          <ConfirmSubmit
                            message={`Tirar o plano de ${firstName(s.full_name)}? As cobranças em aberto deste mês em diante são apagadas.`}
                            className="text-xs font-semibold text-pitanga-600 hover:underline"
                          >
                            Tirar plano
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="pacotes">
        <h2 id="pacotes" className="mb-1 flex items-center gap-2 font-display text-xl font-bold">
          <Package className="size-5 text-bandeira-500" aria-hidden /> Pacotes
        </h2>
        <p className="mb-3 text-sm text-muted">Seus preços. O valor por aula dos mensais considera ≈ 4,33 semanas no mês.</p>
        {pkgs.length ? (
          <ul className="mb-4 space-y-2">
            {pkgs.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <CircleDollarSign className="size-6 shrink-0 text-bandeira-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.kind === "mensal" && p.classes_per_week
                      ? `${brl(Number(p.price))}/mês · ≈ ${classesPerMonth(p.classes_per_week)} aulas/mês`
                      : "Cobrado por aula dada"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{brl(pricePerClass(p))}</p>
                  <p className="text-[11px] text-muted">por aula</p>
                </div>
                <form action={deletePackage}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmSubmit
                    message={`Excluir o pacote "${p.name}"? Os alunos que usam ele mantêm o valor atual.`}
                    className="rounded-xl p-2 text-muted hover:bg-pitanga-100 hover:text-pitanga-600"
                  >
                    <Trash2 className="size-4" aria-label="Excluir pacote" />
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <form action={createSuggestedPackages} className="mb-4 rounded-2xl border-2 border-dashed border-border p-4 text-sm">
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <Wallet className="size-4" aria-hidden /> Comece com pacotes sugeridos
            </p>
            <p className="mb-3 text-muted">Diária R$ 50 · 1x/semana R$ 200 · 2x/semana R$ 350 · 3x/semana R$ 480. Você pode excluir e criar os seus.</p>
            <Button size="sm" variant="secondary">
              Usar sugeridos
            </Button>
          </form>
        )}
        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer font-display font-bold">+ Novo pacote</summary>
          <div className="mt-3">
            <PackageForm />
          </div>
        </details>
      </section>
    </>
  );
}
