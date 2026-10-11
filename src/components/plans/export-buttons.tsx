import { FileDown, Sheet } from "lucide-react";

/** Baixar a ficha em PDF (com folha para preencher à mão) ou CSV (planilha). */
export function PlanExportButtons({ planId }: { planId: string }) {
  const cls =
    "inline-flex items-center gap-2 rounded-2xl border-2 border-border bg-surface px-4 py-2 text-sm font-bold transition hover:border-bandeira-500";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/api/fichas/${planId}/pdf`} download className={cls}>
        <FileDown className="size-4 text-pitanga-600" aria-hidden /> PDF
      </a>
      <a href={`/api/fichas/${planId}/csv`} download className={cls}>
        <Sheet className="size-4 text-bandeira-600" aria-hidden /> CSV
      </a>
      <span className="text-xs text-muted">O PDF traz uma folha para imprimir e anotar à mão.</span>
    </div>
  );
}
