import Link from "next/link";
import { ChevronRight, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { dismissExerciseRequest } from "@/app/exercise-request-actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { loadOpenRequests, type OpenRequest } from "@/lib/exercise-requests-server";
import { AddRequestedForm, LinkExistingForm } from "./request-actions";

/** Lista os pedidos abertos com as ações: adicionar ao catálogo, "já existe" e (admin) descartar. */
export async function RequestsPanel({ isAdmin, blocked, back, ok }: { isAdmin: boolean; blocked: boolean; back: string; ok?: string }) {
  const requests = await loadOpenRequests();
  const notice = ok && (
    <Alert kind="success" className="mb-4">
      {ok}
    </Alert>
  );
  if (!requests.length) {
    return (
      <>
        {notice}
        <EmptyState icon={<span className="text-3xl">💡</span>} title="Nenhum pedido em aberto">
          Quando um aluno não encontrar um exercício, o pedido aparece aqui até alguém adicionar.
        </EmptyState>
      </>
    );
  }
  const supabase = await createClient();
  const { data: defaults } = await supabase.from("equipment").select("id, name").eq("is_default", true).order("name");
  return (
    <>
      {notice}
      <ul className="space-y-3">
        {requests.map((r) => (
          <li key={r.key} className="rounded-3xl border border-border bg-surface p-4">
            <p className="font-display text-lg font-bold leading-tight">{r.name}</p>
            <p className="text-xs text-muted">
              {r.count === 1 ? "1 aluno pediu" : `${r.count} alunos pediram`} · desde {formatDate(r.since)}
            </p>
            {r.notes.map((n, i) => (
              <p key={i} className="mt-1 text-sm italic text-muted">
                “{n}”
              </p>
            ))}
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              {blocked ? (
                <p className="text-sm text-muted">Seu acesso para adicionar exercícios está bloqueado pelo administrador.</p>
              ) : (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-bandeira-600 dark:text-bandeira-100">
                    + Adicionar ao catálogo
                  </summary>
                  <div className="mt-2">
                    <AddRequestedForm requestKey={r.key} name={r.name} back={back} />
                  </div>
                </details>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-muted">Já existe no catálogo com outro nome</summary>
                <div className="mt-2">
                  <LinkExistingForm requestKey={r.key} options={defaults ?? []} back={back} />
                </div>
              </details>
              {isAdmin && (
                <form action={dismissExerciseRequest}>
                  <input type="hidden" name="key" value={r.key} />
                  <ConfirmSubmit
                    message={`Descartar o pedido "${r.name}"? Quem pediu é avisado.`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-pitanga-600 hover:underline"
                  >
                    <Trash2 className="size-3.5" aria-hidden /> Descartar pedido
                  </ConfirmSubmit>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Aviso na tela inicial (Personal e admin) enquanto houver pedidos em aberto. */
export function RequestsBanner({ requests, href }: { requests: OpenRequest[]; href: string }) {
  if (!requests.length) return null;
  const names = requests.slice(0, 3).map((r) => r.name);
  return (
    <Link
      href={href}
      className="mb-4 flex items-center gap-3 rounded-3xl border-2 border-ipe-500 bg-surface p-4 transition hover:bg-ipe-100/60 dark:hover:bg-ipe-500/10"
    >
      <span className="text-2xl" aria-hidden>
        💡
      </span>
      <span className="flex-1 text-sm">
        <span className="block font-display text-base font-bold">
          {requests.length === 1 ? "1 exercício pedido pelos alunos" : `${requests.length} exercícios pedidos pelos alunos`}
        </span>
        {names.join(", ")}
        {requests.length > 3 && "…"} · Adicione ao catálogo para todos usarem.
      </span>
      <ChevronRight className="size-5 text-muted" aria-hidden />
    </Link>
  );
}
