import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { respondTransfer } from "../actions";

export const metadata: Metadata = { title: "Pedidos" };

const STATUS_TONE = { aceito: "green", recusado: "red", cancelado: "neutral", pendente: "yellow" } as const;

export default async function SolicitacoesPage() {
  const { profile } = await requireRole("personal");
  const supabase = await createClient();
  const { data: all } = await supabase
    .from("student_transfers")
    .select(
      "id, kind, status, created_at, responded_at, from_personal_id, to_personal_id, student:profiles!student_transfers_student_id_fkey(full_name), from:profiles!student_transfers_from_personal_id_fkey(full_name), to:profiles!student_transfers_to_personal_id_fkey(full_name)",
    )
    .or(`to_personal_id.eq.${profile.id},from_personal_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const pending = all?.filter((t) => t.status === "pendente" && t.to_personal_id === profile.id) ?? [];
  const history = all?.filter((t) => !pending.includes(t)) ?? [];

  return (
    <>
      <PageTitle sub="Alunos que outros Personais querem compartilhar ou transferir para você.">Pedidos</PageTitle>

      {!pending.length ? (
        <EmptyState icon={<Inbox className="size-8" />} title="Nenhum pedido pendente" />
      ) : (
        <ul className="space-y-3">
          {pending.map((t) => (
            <li key={t.id}>
              <Card>
                <Badge tone={t.kind === "transferencia" ? "yellow" : "blue"}>
                  {t.kind === "transferencia" ? "Transferência" : "Compartilhamento"}
                </Badge>
                <p className="mt-2">
                  <strong>{t.from?.full_name}</strong>{" "}
                  {t.kind === "transferencia" ? "quer transferir" : "quer compartilhar"} o aluno{" "}
                  <strong>{t.student?.full_name ?? "—"}</strong> com você.
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t.kind === "transferencia"
                    ? "Ao aceitar, você vira o Personal responsável, com acesso a todo o histórico."
                    : "Ao aceitar, você poderá ver fichas, histórico e dashboard, montar fichas e registrar treinos."}
                </p>
                <div className="mt-4 flex gap-2">
                  <form action={respondTransfer} className="flex-1">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="accept" value="1" />
                    <Button className="w-full">Aceitar</Button>
                  </form>
                  <form action={respondTransfer} className="flex-1">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="accept" value="0" />
                    <Button variant="secondary" className="w-full">
                      Recusar
                    </Button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!!history.length && (
        <>
          <h2 className="mb-3 mt-8 font-display text-xl font-bold">Histórico</h2>
          <ul className="space-y-2 text-sm">
            {history.map((t) => {
              const sent = t.from_personal_id === profile.id;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-3">
                  <span>
                    {sent ? "Você → " + (t.to?.full_name ?? "—") : (t.from?.full_name ?? "—") + " → você"} ·{" "}
                    {t.kind === "transferencia" ? "transferência" : "compartilhamento"}
                    {t.student?.full_name && <> de {t.student.full_name}</>}
                    <span className="block text-xs text-muted">{formatDate(t.created_at)}</span>
                  </span>
                  <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
