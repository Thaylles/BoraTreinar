"use client";

import { useActionState, useState } from "react";
import { saveBilling } from "@/app/personal/financeiro/actions";
import { inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { packageSummary, type PackageKind } from "@/lib/finance";

type Pkg = { id: string; name: string; kind: PackageKind; price: number; classes_per_week: number | null };

/** Plano do aluno: pacote (ou valor personalizado) e dia do pagamento. */
export function BillingForm({
  studentId,
  packages,
  current,
}: {
  studentId: string;
  packages: Pkg[];
  current?: { package_id: string | null; label: string; kind: PackageKind; amount: number; due_day: number } | null;
}) {
  const [state, action] = useActionState(saveBilling, undefined);
  const [pkg, setPkg] = useState(current ? (current.package_id ?? "custom") : (packages[0]?.id ?? "custom"));
  const [kind, setKind] = useState<PackageKind>(current?.kind ?? "mensal");
  const custom = pkg === "custom";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="student_id" value={studentId} />
      <label className="block space-y-1.5 text-sm font-semibold">
        <span className="block">Pacote</span>
        <select name="package_id" value={pkg} onChange={(e) => setPkg(e.target.value)} className={inputClass}>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {packageSummary(p)}
            </option>
          ))}
          <option value="custom">Valor personalizado…</option>
        </select>
      </label>
      {custom && (
        <div className="grid grid-cols-2 gap-3">
          <label className="min-w-0 space-y-1.5 text-sm font-semibold">
            <span className="block">Cobrança</span>
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as PackageKind)} className={inputClass}>
              <option value="mensal">Valor fixo por mês</option>
              <option value="por_aula">Por aula dada</option>
            </select>
          </label>
          <label className="min-w-0 space-y-1.5 text-sm font-semibold">
            <span className="block">{kind === "mensal" ? "Valor/mês (R$)" : "Valor/aula (R$)"}</span>
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={current && !current.package_id ? String(current.amount).replace(".", ",") : ""}
              className={inputClass}
            />
          </label>
          <input type="hidden" name="label" value={kind === "mensal" ? "Mensalidade" : "Aulas avulsas"} />
        </div>
      )}
      <label className="block space-y-1.5 text-sm font-semibold">
        <span className="block">Dia do pagamento</span>
        <select name="due_day" defaultValue={current?.due_day ?? 10} className={inputClass}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              Todo dia {d}
            </option>
          ))}
        </select>
        <span className="block text-xs font-normal text-muted">
          O aluno recebe um lembrete 1 dia antes, no dia e no dia seguinte (se ainda não tiver pago).
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton size="sm" pendingText="Salvando…">
        Salvar plano
      </SubmitButton>
    </form>
  );
}
