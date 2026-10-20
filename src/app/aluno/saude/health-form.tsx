"use client";

import { useActionState } from "react";
import { saveHealthForm } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { MULTI_FIELDS, PARQ, SINGLE_FIELDS, type HealthForm } from "@/lib/health";

const chip =
  "cursor-pointer select-none rounded-full border-2 border-border px-3 py-1.5 text-sm font-semibold transition has-[:checked]:border-bandeira-500 has-[:checked]:bg-bandeira-500 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bandeira-500/40";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-3xl border border-border bg-surface p-4">
      <legend className="px-1 font-display text-base font-bold">{title}</legend>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** Anamnese com respostas padronizadas (PAR-Q + saúde + hábitos). */
export function HealthFormView({ initial }: { initial: HealthForm | null }) {
  const [state, action] = useActionState(saveHealthForm, undefined);
  const has = (key: keyof HealthForm, v: string) => ((initial?.[key] as string[] | undefined) ?? []).includes(v);
  return (
    <form action={action} className="space-y-4">
      <Section title="PAR-Q (prontidão para atividade física)" hint="Responda com sinceridade: se alguma for “sim”, vamos pedir uma liberação médica.">
        <ol className="space-y-3">
          {PARQ.map((q, i) => (
            <li key={q.value}>
              <p className="mb-1.5 text-sm">
                <strong>{i + 1}.</strong> {q.label}
              </p>
              <div className="flex gap-2">
                {[
                  ["sim", "Sim"],
                  ["nao", "Não"],
                ].map(([v, l]) => (
                  <label key={v} className={chip}>
                    <input
                      type="radio"
                      name={`parq_${q.value}`}
                      value={v}
                      required
                      defaultChecked={initial ? (v === "sim") === initial.parq_yes.includes(q.value) : false}
                      className="sr-only"
                    />
                    {l}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {MULTI_FIELDS.map((q) => (
        <Section key={q.key} title={q.title} hint={q.none ? `Marque todas que se aplicam. Se não tiver, deixe em branco (${q.none.toLowerCase()}).` : "Marque um ou mais."}>
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => (
              <label key={o.value} className={chip}>
                <input type="checkbox" name={q.key} value={o.value} defaultChecked={has(q.key, o.value)} className="sr-only" />
                {o.label}
              </label>
            ))}
          </div>
        </Section>
      ))}

      {SINGLE_FIELDS.map((q) => (
        <Section key={q.key} title={q.title}>
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => (
              <label key={o.value} className={chip}>
                <input type="radio" name={q.key} value={o.value} defaultChecked={initial?.[q.key] === o.value} className="sr-only" />
                {o.label}
              </label>
            ))}
          </div>
        </Section>
      ))}

      <Section title="Fuma?">
        <div className="flex gap-2">
          {[
            ["sim", "Sim", true],
            ["nao", "Não", false],
          ].map(([v, l, b]) => (
            <label key={String(v)} className={chip}>
              <input type="radio" name="smoker" value={String(v)} defaultChecked={initial?.smoker === b} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Algo mais que seu Personal precisa saber?" hint="Opcional. Ex.: onde exatamente dói, em que movimento, recomendações do médico.">
        <textarea name="notes" rows={3} maxLength={1000} defaultValue={initial?.notes ?? ""} className={inputClass} />
      </Section>

      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Salvando…">
        Salvar anamnese
      </SubmitButton>
    </form>
  );
}
