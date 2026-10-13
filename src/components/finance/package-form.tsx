"use client";

import { useActionState, useState } from "react";
import { createPackage } from "@/app/personal/financeiro/actions";
import { Field, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { brl, classesPerMonth, parseMoney, pricePerClass } from "@/lib/finance";

/** Novo pacote: por aula (diária) ou mensal (N aulas por semana). */
export function PackageForm() {
  const [state, action] = useActionState(createPackage, undefined);
  const [kind, setKind] = useState<"por_aula" | "mensal">("mensal");
  const [perWeek, setPerWeek] = useState(2);
  const [price, setPrice] = useState("");
  const value = parseMoney(price);
  return (
    <form action={action} className="space-y-3" key={state?.ok}>
      <Field label="Nome do pacote" name="name" required maxLength={60} placeholder="Ex.: 2x por semana" />
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 space-y-1.5 text-sm font-semibold">
          <span className="block">Tipo</span>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClass}>
            <option value="mensal">Mensal</option>
            <option value="por_aula">Por aula (diária)</option>
          </select>
        </label>
        {kind === "mensal" ? (
          <label className="min-w-0 space-y-1.5 text-sm font-semibold">
            <span className="block">Aulas por semana</span>
            <select name="classes_per_week" value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} className={inputClass}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
      </div>
      <Field
        label={kind === "mensal" ? "Valor por mês (R$)" : "Valor da aula (R$)"}
        name="price"
        required
        inputMode="decimal"
        placeholder={kind === "mensal" ? "350" : "50"}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      {kind === "mensal" && value ? (
        <p className="text-sm text-muted">
          ≈ {classesPerMonth(perWeek)} aulas no mês ·{" "}
          <strong className="text-foreground">{brl(pricePerClass({ kind, price: value, classes_per_week: perWeek }))} por aula</strong>
        </p>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Criar pacote</SubmitButton>
    </form>
  );
}
