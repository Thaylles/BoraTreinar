import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, Copy, Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { PlanItemsList } from "@/components/plans/plan-view";
import { PlanExportButtons } from "@/components/plans/export-buttons";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { loadPlan } from "@/lib/plans-server";
import { createClient } from "@/lib/supabase/server";
import { archivePlan, deletePlan, duplicatePlan } from "../actions";

export const metadata: Metadata = { title: "Ficha" };

export default async function FichaPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ salvo?: string; duplicada?: string; erro?: string }>;
}) {
  const [{ planId }, sp, { profile }] = await Promise.all([params, searchParams, requireRole("personal")]);
  const loaded = await loadPlan(planId);
  if (!loaded) notFound();
  const { plan, items } = loaded;

  const supabase = await createClient();
  const { data: myStudents } = await supabase
    .from("personal_students")
    .select("student:profiles!personal_students_student_id_fkey(id, full_name)")
    .eq("personal_id", profile.id)
    .eq("status", "ativo")
    .is("archived_at", null);
  const others = (myStudents ?? [])
    .map((s) => s.student)
    .filter((s): s is { id: string; full_name: string } => !!s && s.id !== plan.student_id)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

  const back = plan.is_template ? "/personal/modelos" : `/personal/alunos/${plan.student_id}`;
  const expired = plan.valid_until && plan.valid_until < new Date().toISOString().slice(0, 10);
  const byStudent = !plan.is_template && !!plan.student_id && plan.created_by === plan.student_id;

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {plan.is_template ? "Modelos" : plan.student?.full_name}
      </Link>

      {sp.salvo && <Alert kind="success" className="mb-4">Ficha salva! Tá pago ✅</Alert>}
      {sp.duplicada && <Alert kind="success" className="mb-4">Ficha duplicada. Esta é a cópia — ajuste o que precisar.</Alert>}
      {sp.erro && <Alert className="mb-4">{sp.erro}</Alert>}

      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {plan.is_template && <Badge tone="yellow">Modelo</Badge>}
          {plan.archived_at && <Badge>Arquivada</Badge>}
          {expired && <Badge tone="red">Vencida</Badge>}
          {byStudent && <Badge tone="blue">Criada pelo aluno</Badge>}
        </div>
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight">{plan.name}</h1>
        {plan.goal && <p className="text-muted">🎯 {plan.goal}</p>}
        <p className="mt-1 text-xs text-muted">
          Criada por {plan.created_by === profile.id ? "você" : (plan.creator?.full_name ?? "—")} em {formatDate(plan.created_at)}
          {plan.valid_until && ` · válida até ${formatDate(`${plan.valid_until}T12:00:00`)}`}
        </p>
      </div>

      {plan.notes && <Card className="mb-4 whitespace-pre-line text-sm">{plan.notes}</Card>}

      {byStudent ? (
        <p className="mb-6 rounded-2xl bg-anil-700/5 px-4 py-3 text-sm text-muted dark:bg-white/5">
          Ficha montada pelo próprio aluno: só ele edita. Para propor mudanças, duplique abaixo para o mesmo aluno e ajuste a cópia.
        </p>
      ) : (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/personal/fichas/${planId}/editar`}
            className="inline-flex items-center gap-2 rounded-2xl bg-bandeira-500 px-4 py-2.5 font-display font-bold text-white hover:bg-bandeira-600"
          >
            <Pencil className="size-4" aria-hidden /> Editar
          </Link>
        </div>
      )}
      <div className="mb-6 -mt-3">
        <PlanExportButtons planId={planId} />
      </div>

      <PlanItemsList items={items} />

      <Card className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Copy className="size-5" aria-hidden /> Duplicar
        </h2>
        <form action={duplicatePlan} className="space-y-3">
          <input type="hidden" name="plan_id" value={planId} />
          <input type="hidden" name="student_id" value={plan.student_id ?? ""} />
          <select name="target" required defaultValue="" className={inputClass} aria-label="Destino da cópia">
            <option value="" disabled>
              Para onde?
            </option>
            {!plan.is_template && <option value="este">Para {plan.student?.full_name} (mesmo aluno)</option>}
            <option value="modelo">Salvar como modelo</option>
            {others.length > 0 && (
              <optgroup label="Para outro aluno">
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <input name="name" maxLength={60} placeholder={`Nome da cópia (padrão: ${plan.name})`} className={inputClass} aria-label="Nome da cópia" />
          <Button type="submit" variant="secondary" className="w-full">
            Duplicar ficha
          </Button>
        </form>
        <Link
          href={`/personal/modelos/aplicar?ficha=${planId}`}
          className="mt-3 block text-center text-sm font-semibold text-bandeira-600 underline-offset-4 hover:underline dark:text-bandeira-100"
        >
          Duplicar para vários alunos de uma vez →
        </Link>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        {!plan.is_template && (
          <form action={archivePlan}>
            <input type="hidden" name="plan_id" value={planId} />
            <input type="hidden" name="archived" value={plan.archived_at ? "0" : "1"} />
            <button className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-muted hover:bg-border/50 hover:text-foreground">
              {plan.archived_at ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
              {plan.archived_at ? "Reativar ficha" : "Arquivar ficha"}
            </button>
          </form>
        )}
        <form action={deletePlan}>
          <input type="hidden" name="plan_id" value={planId} />
          <input type="hidden" name="back" value={back} />
          <ConfirmSubmit
            message="Excluir esta ficha? Os treinos já registrados continuam no histórico."
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15"
          >
            <Trash2 className="size-4" aria-hidden /> Excluir
          </ConfirmSubmit>
        </form>
      </div>
    </>
  );
}
