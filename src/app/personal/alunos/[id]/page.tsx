import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, Mail, Phone } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { formatPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { cancelTransfer, revokeShare, setArchived } from "../../actions";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Aluno" };

export default async function AlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile: me } = await requireRole("personal");
  const supabase = await createClient();

  const [{ data: student }, { data: links }, { data: transfers }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).eq("role", "aluno").maybeSingle(),
    supabase
      .from("personal_students")
      .select("personal_id, role, archived_at, created_at, personal:profiles!personal_students_personal_id_fkey(full_name, email)")
      .eq("student_id", id)
      .eq("status", "ativo"),
    supabase
      .from("student_transfers")
      .select("id, kind, created_at, to:profiles!student_transfers_to_personal_id_fkey(full_name)")
      .eq("student_id", id)
      .eq("from_personal_id", me.id)
      .eq("status", "pendente"),
  ]);

  const myLink = links?.find((l) => l.personal_id === me.id);
  if (!student || !myLink) notFound();
  const iAmResponsible = myLink.role === "responsavel";

  return (
    <>
      <Link href="/personal/alunos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Alunos
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-bandeira-500 font-display text-3xl font-bold text-white">
          {student.full_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight">{student.full_name}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            {iAmResponsible ? <Badge tone="green">Você é o responsável</Badge> : <Badge tone="blue">Compartilhado com você</Badge>}
            {myLink.archived_at && <Badge>Arquivado</Badge>}
          </div>
        </div>
      </div>

      <Card className="mb-4 space-y-2 text-sm">
        <p className="flex items-center gap-2">
          <Phone className="size-4 text-muted" aria-hidden /> {formatPhoneBR(student.phone) || "Sem telefone"}
        </p>
        <p className="flex items-center gap-2 break-all">
          <Mail className="size-4 text-muted" aria-hidden /> {student.email}
        </p>
        {student.birth_date && (
          <p className="text-muted">Nascimento: {formatDate(`${student.birth_date}T12:00:00`)}</p>
        )}
        <p className="text-muted">Aluno desde {formatDate(myLink.created_at)}</p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 font-display text-lg font-bold">Personais deste aluno</h2>
        <ul className="space-y-2">
          {links?.map((l) => (
            <li key={l.personal_id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-semibold">{l.personal?.full_name}</span>{" "}
                <span className="text-muted">· {l.role === "responsavel" ? "responsável" : "compartilhado"}</span>
              </span>
              {iAmResponsible && l.role === "compartilhado" && (
                <form action={revokeShare}>
                  <input type="hidden" name="student_id" value={id} />
                  <input type="hidden" name="personal_id" value={l.personal_id} />
                  <button className="rounded-xl px-2 py-1 font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15">
                    Revogar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {!!transfers?.length && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Pedidos aguardando resposta</p>
            {transfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {t.kind === "compartilhamento" ? "Compartilhar" : "Transferir"} com{" "}
                  <strong>{t.to?.full_name}</strong>
                </span>
                <form action={cancelTransfer}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="rounded-xl px-2 py-1 font-semibold text-muted hover:bg-border/50">Cancelar</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      {iAmResponsible && (
        <Card className="mb-4">
          <h2 className="mb-3 font-display text-lg font-bold">Compartilhar ou transferir</h2>
          <TransferForm studentId={id} />
        </Card>
      )}

      <form action={setArchived} className="mt-6">
        <input type="hidden" name="student_id" value={id} />
        <input type="hidden" name="archived" value={myLink.archived_at ? "0" : "1"} />
        <button className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground">
          {myLink.archived_at ? (
            <>
              <ArchiveRestore className="size-4" aria-hidden /> Reativar aluno
            </>
          ) : (
            <>
              <Archive className="size-4" aria-hidden /> Arquivar aluno
            </>
          )}
        </button>
      </form>

      <p className="mt-8 rounded-2xl bg-ipe-100 p-4 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
        🚧 Fichas, histórico e dashboard deste aluno chegam nas próximas etapas.
      </p>
    </>
  );
}
