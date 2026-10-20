import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { brl, paymentStatus } from "@/lib/finance";
import { MONTHS } from "@/lib/schedule";
import { Badge, EmptyState, PageTitle } from "@/components/ui/card";
import { OccurrenceList } from "@/components/agenda/occurrence-list";
import { requireStudent } from "@/lib/auth";
import { PixPay } from "@/components/finance/pix-pay";
import type { PixSettings } from "@/components/finance/pix-form";
import { loadAgenda } from "@/lib/agenda-server";

export const metadata: Metadata = { title: "Minhas aulas" };

const STATUS = {
  pago: { label: "Pago", tone: "green" },
  atrasado: { label: "Atrasado", tone: "red" },
  hoje: { label: "Vence hoje", tone: "yellow" },
  pendente: { label: "Em aberto", tone: "neutral" },
} as const;

export default async function AlunoAulasPage() {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const [{ occurrences, today }, { data: payments }] = await Promise.all([
    loadAgenda({ studentId: profile.id, days: 21 }),
    supabase
      .from("payments")
      .select("*, personal:profiles!payments_personal_id_fkey(full_name)")
      .eq("student_id", profile.id)
      .order("month", { ascending: false })
      .limit(6),
  ]);
  // Pix dos Personais com cobrança em aberto (sem a tabela ainda, só não mostra o QR Code).
  const open = (payments ?? []).filter((p) => !p.paid_at && Number(p.amount) > 0);
  const { data: pixRows } = open.length
    ? await supabase.from("pix_settings").select("*").in("personal_id", [...new Set(open.map((p) => p.personal_id))])
    : { data: [] };
  const pixOf = new Map<string, PixSettings>((pixRows ?? []).map((x) => [x.personal_id, x]));
  return (
    <>
      <PageTitle sub="Aulas presenciais com seu Personal nas próximas 3 semanas.">Minhas aulas</PageTitle>
      {!!payments?.length && (
        <section aria-labelledby="pagamentos" className="mb-8">
          <h2 id="pagamentos" className="mb-2 font-display text-xl font-bold">
            Pagamentos
          </h2>
          <ul className="space-y-2">
            {payments.map((p) => {
              const st = STATUS[paymentStatus(p, today)];
              return (
                <li key={p.id} className="rounded-2xl border border-border bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">
                        {MONTHS[Number(p.month.slice(5, 7)) - 1]} · {p.personal?.full_name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {p.description} · vence {p.due_on.slice(8, 10)}/{p.due_on.slice(5, 7)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{brl(Number(p.amount))}</p>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  </div>
                  {!p.paid_at && Number(p.amount) > 0 && (
                    <PixPay payment={{ ...p, amount: Number(p.amount) }} pix={pixOf.get(p.personal_id) ?? null} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {!occurrences.length ? (
        <EmptyState icon={<CalendarDays className="size-8" />} title="Nenhuma aula agendada">
          Quando seu Personal marcar aulas presenciais, elas aparecem aqui.
        </EmptyState>
      ) : (
        <OccurrenceList occurrences={occurrences} today={today} showPersonal />
      )}
    </>
  );
}
