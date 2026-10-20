import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MULTI_FIELDS, PARQ, SINGLE_FIELDS, cautionsFor, labelOf, needsClearance, type HealthForm } from "@/lib/health";
import { groupLabel, type MuscleGroup } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/card";

/** Ficha de saúde (anamnese) do aluno, para o Personal: riscos, dores, liberação e grupos com cuidado. */
export async function HealthSummary({ studentId }: { studentId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("health_forms").select("*").eq("student_id", studentId).maybeSingle();
  const form = data as HealthForm | null;

  if (!form) {
    return (
      <section className="mb-6 rounded-3xl border border-dashed border-border p-4 text-sm">
        <p className="font-display text-lg font-bold">🩺 Anamnese</p>
        <p className="text-muted">O aluno ainda não preencheu. Ele vê um aviso no início do app para preencher.</p>
      </section>
    );
  }

  const risk = needsClearance(form);
  const clearance = form.clearance_path
    ? (await supabase.storage.from("medical").createSignedUrl(form.clearance_path, 600)).data?.signedUrl ?? null
    : null;
  const cautions = Object.entries(cautionsFor(form));
  const answered = MULTI_FIELDS.filter((q) => (form[q.key] as string[]).length);

  return (
    <section className={`mb-6 rounded-3xl border p-4 text-sm ${risk ? "border-pitanga-500/60 bg-pitanga-100/40 dark:bg-pitanga-500/10" : "border-border bg-surface"}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-lg font-bold">🩺 Anamnese</p>
        <span className="text-xs text-muted">atualizada em {formatDate(form.updated_at!)}</span>
      </div>

      {risk ? (
        <div className="mb-3 space-y-1">
          <Badge tone="red">⚠️ PAR-Q com “sim”</Badge>
          <ul className="list-disc pl-5">
            {form.parq_yes.map((v) => (
              <li key={v}>{labelOf(PARQ, v)}</li>
            ))}
          </ul>
          <p className="font-semibold">
            Liberação médica:{" "}
            {clearance ? (
              <a href={clearance} target="_blank" rel="noreferrer" className="text-bandeira-600 underline dark:text-bandeira-100">
                ver arquivo enviado
              </a>
            ) : (
              <span className="text-pitanga-600">ainda não enviada</span>
            )}
          </p>
        </div>
      ) : (
        <p className="mb-3">
          <Badge tone="green">PAR-Q sem restrições</Badge>
        </p>
      )}

      {!!cautions.length && (
        <div className="mb-3 rounded-2xl bg-ipe-100 p-3 text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
          <p className="mb-1 font-bold">Cuidado ao montar a ficha</p>
          <ul className="space-y-0.5">
            {cautions.map(([g, reasons]) => (
              <li key={g}>
                <strong>{groupLabel(g as MuscleGroup)}</strong>: {reasons.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="space-y-1.5">
        {answered.map((q) => (
          <div key={q.key}>
            <dt className="text-xs font-semibold text-muted">{q.title}</dt>
            <dd>{(form[q.key] as string[]).map((v) => labelOf(q.options, v)).join(", ")}</dd>
          </div>
        ))}
        {SINGLE_FIELDS.filter((q) => form[q.key]).map((q) => (
          <div key={q.key}>
            <dt className="text-xs font-semibold text-muted">{q.title}</dt>
            <dd>{labelOf(q.options, form[q.key]!)}</dd>
          </div>
        ))}
        {form.smoker != null && (
          <div>
            <dt className="text-xs font-semibold text-muted">Fuma?</dt>
            <dd>{form.smoker ? "Sim" : "Não"}</dd>
          </div>
        )}
        {form.notes && (
          <div>
            <dt className="text-xs font-semibold text-muted">Observações do aluno</dt>
            <dd>💬 “{form.notes}”</dd>
          </div>
        )}
      </dl>
      <Link href="/personal/saude" className="mt-3 inline-block text-xs font-semibold text-anil-700 hover:underline dark:text-ipe-400">
        Ver levantamento de todos os alunos →
      </Link>
    </section>
  );
}
