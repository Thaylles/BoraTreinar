import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BicepsFlexed, Gauge } from "lucide-react";
import { Card } from "@/components/ui/card";
import { groupLabel, type MuscleGroup } from "@/lib/catalog";
import { formatKg } from "@/lib/stats";
import type { GroupVolume, Stagnation, StrengthTrend } from "@/lib/evolution";
import { cn } from "@/lib/cn";

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

type Props = {
  insights: {
    trends: StrengthTrend[];
    stagnant: Stagnation[];
    volume: { weeks: string[]; groups: GroupVolume[] };
  };
  names: Record<string, string>;
  exerciseHref: (id: string) => string;
};

/** Painel do Personal: exercícios parados, séries por grupo muscular e força estimada (1RM). */
export function CoachInsights({ insights, names, exerciseHref }: Props) {
  const { trends, stagnant, volume } = insights;
  const max = Math.max(1, ...volume.groups.flatMap((g) => g.weeks));
  return (
    <div className="mb-6 space-y-4">
      <Card className={cn(stagnant.length && "border-2 border-pitanga-500/50")}>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <AlertTriangle className={cn("size-5", stagnant.length ? "text-pitanga-500" : "text-muted")} aria-hidden /> Alertas de estagnação
        </h2>
        {stagnant.length ? (
          <ul className="space-y-1">
            {stagnant.map((s) => (
              <li key={s.id}>
                <Link href={exerciseHref(s.id)} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-border/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{names[s.id] ?? "Exercício"}</span>
                    <span className="text-xs text-muted">
                      {s.sessions} treinos desde a última evolução · máx {formatKg(s.load)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-pitanga-100 px-2.5 py-1 text-xs font-bold text-pitanga-600 dark:bg-pitanga-500/20">
                    {s.weeks} semanas sem subir carga
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhum exercício parado: tudo evoluindo nas últimas 3 semanas. 👏</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <BicepsFlexed className="size-5 text-bandeira-500" aria-hidden /> Séries por grupo muscular
        </h2>
        <p className="mb-3 text-xs text-muted">
          Séries feitas por semana (seg–dom), da mais antiga à atual. Referência comum: 10 a 20 por grupo.
        </p>
        {volume.groups.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-2 font-semibold">Grupo</th>
                  {volume.weeks.map((w, i) => (
                    <th key={w} className="px-1 py-1 text-center font-semibold tabular-nums">
                      {i === volume.weeks.length - 1 ? "Atual" : ddmm(w)}
                    </th>
                  ))}
                  <th className="py-1 pl-2 text-right font-semibold">Média</th>
                </tr>
              </thead>
              <tbody>
                {volume.groups.map((g) => (
                  <tr key={g.group} className="border-t border-border">
                    <td className="py-2 pr-2 font-semibold">{groupLabel(g.group as MuscleGroup)}</td>
                    {g.weeks.map((n, i) => (
                      <td key={i} className="px-1 py-2 text-center">
                        <span
                          className="mx-auto flex h-7 w-9 items-center justify-center rounded-lg text-xs font-bold tabular-nums"
                          style={{
                            background: n
                              ? `color-mix(in srgb, var(--color-bandeira-500) ${15 + Math.round((n / max) * 70)}%, transparent)`
                              : undefined,
                          }}
                          title={`${n} séries · ${formatKg(g.volume[i])}`}
                        >
                          {n || "—"}
                        </span>
                      </td>
                    ))}
                    <td className="py-2 pl-2 text-right font-display font-bold tabular-nums">{g.avg.toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">Sem treinos de musculação nas últimas 4 semanas.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <Gauge className="size-5 text-anil-500" aria-hidden /> Força estimada (1RM)
        </h2>
        <p className="mb-2 text-xs text-muted">
          Carga máxima estimada para 1 repetição (fórmula de Epley, melhor série de até 12 reps). Últimas 4 semanas × as 4 anteriores.
        </p>
        {trends.length ? (
          <ul className="space-y-1">
            {trends.slice(0, 10).map((t) => (
              <li key={t.id}>
                <Link href={exerciseHref(t.id)} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-border/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{names[t.id] ?? "Exercício"}</span>
                    <span className="text-xs text-muted">
                      {t.previous ? `antes ${formatKg(t.previous)}` : "sem base nas 4 semanas anteriores"} · em {ddmm(t.date)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-lg font-bold tabular-nums">{formatKg(t.current)}</span>
                    {t.deltaPct !== null && t.deltaPct !== 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center text-xs font-semibold tabular-nums",
                          t.deltaPct > 0 ? "text-bandeira-600 dark:text-bandeira-100" : "text-pitanga-600",
                        )}
                      >
                        {t.deltaPct > 0 ? (
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowDownRight className="size-3.5" aria-hidden />
                        )}
                        {Math.abs(t.deltaPct).toLocaleString("pt-BR")}%
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sem séries com carga nas últimas 4 semanas.</p>
        )}
      </Card>
    </div>
  );
}
