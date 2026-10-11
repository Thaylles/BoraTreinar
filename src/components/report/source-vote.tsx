import { ThumbsUp } from "lucide-react";
import { setPreferredSource } from "@/app/personal/relatorios/actions";
import { SOURCE_LABEL, type ReportContent, type SuggestionSource } from "@/lib/report";
import { cn } from "@/lib/cn";

/** "Qual sugestão foi mais útil?" — o voto alimenta o placar da comparação regras × IAs. */
export function SourceVote({ reportId, content, preferred }: { reportId: string; content: ReportContent; preferred: string | null }) {
  const options: SuggestionSource[] = ["regras", ...(content.aiStatus ?? []).filter((a) => a.ok).map((a) => a.source)];
  if (options.length < 2) return null;
  return (
    <section aria-labelledby="voto" className="rounded-3xl border-2 border-dashed border-ipe-500/60 bg-ipe-100/50 p-4 dark:bg-ipe-500/10">
      <h2 id="voto" className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
        <ThumbsUp className="size-5 text-ipe-600" aria-hidden /> Qual sugestão foi mais útil nesta semana?
      </h2>
      <p className="mb-3 text-xs text-muted">Seu voto entra no placar da página Relatórios, para comparar as IAs.</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <form key={o} action={setPreferredSource}>
            <input type="hidden" name="report_id" value={reportId} />
            <input type="hidden" name="source" value={preferred === o ? "" : o} />
            <button
              aria-pressed={preferred === o}
              className={cn(
                "rounded-2xl border-2 px-3 py-2 text-sm font-bold transition",
                preferred === o ? "border-bandeira-500 bg-bandeira-500 text-white" : "border-border bg-surface hover:border-bandeira-500",
              )}
            >
              {preferred === o ? "✓ " : ""}
              {SOURCE_LABEL[o]}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
