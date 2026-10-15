import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { achievementStats, shortNumber, TIER_ICON, TIER_LABEL, TIER_POINTS, type AchievementRow } from "@/lib/achievements";

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "conquistadas", label: "Conquistadas" },
  { key: "faltam", label: "A conquistar" },
  { key: "secretas", label: "Secretas" },
] as const;
export type AchievementFilter = (typeof FILTERS)[number]["key"];

const TIER_RING: Record<AchievementRow["tier"], string> = {
  bronze: "from-amber-700 to-amber-500",
  prata: "from-slate-400 to-slate-200",
  ouro: "from-ipe-500 to-ipe-400",
  platina: "from-sky-400 to-indigo-300",
};

/** Sala de troféus: resumo, filtros e conquistas agrupadas por categoria. */
export function AchievementsView({
  rows,
  filter,
  basePath,
}: {
  rows: AchievementRow[];
  filter: AchievementFilter;
  basePath: string;
}) {
  const stats = achievementStats(rows);
  const list = rows.filter((r) =>
    filter === "conquistadas" ? r.unlocked_at : filter === "faltam" ? !r.unlocked_at : filter === "secretas" ? r.hidden : true,
  );
  const categories = [...new Set(list.map((r) => r.category))];
  const hasSecrets = rows.some((r) => r.hidden);
  const filters = hasSecrets ? FILTERS : FILTERS.filter((f) => f.key !== "secretas");
  const pct = Math.round((stats.unlocked / Math.max(1, stats.total)) * 100);

  return (
    <>
      <section className="mb-5 rounded-3xl bg-gradient-to-br from-anil-700 to-anil-900 p-5 text-white shadow-md">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-white/75">Conquistas</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">
              {stats.unlocked}
              <span className="text-xl text-white/60">/{stats.total}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/75">Pontos</p>
            <p className="font-display text-2xl font-bold tabular-nums">{stats.points.toLocaleString("pt-BR")}</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Conquistas liberadas">
          <div className="h-full rounded-full bg-ipe-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          {stats.byTier.map((t) => (
            <div key={t.tier} className="rounded-xl bg-white/10 px-1 py-2">
              <p className="text-lg" aria-hidden>
                {TIER_ICON[t.tier]}
              </p>
              <p className="font-bold tabular-nums">
                {t.got}/{t.total}
              </p>
              <p className="text-white/70">{TIER_LABEL[t.tier]}</p>
            </div>
          ))}
        </div>
        {hasSecrets && (
          <p className="mt-3 text-xs text-white/75">
            🔒 {stats.hiddenLeft} conquistas secretas ainda escondidas. Você só descobre quando liberar!
          </p>
        )}
      </section>

      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4" aria-label="Filtrar conquistas">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "todas" ? basePath : `${basePath}?filtro=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold",
              filter === f.key ? "bg-anil-700 text-white dark:bg-ipe-500 dark:text-anil-900" : "bg-surface text-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {!list.length && <p className="text-sm text-muted">Nada por aqui ainda. Bora treinar! 💪</p>}

      {categories.map((cat) => (
        <section key={cat} className="mb-6" aria-labelledby={`cat-${cat}`}>
          <h2 id={`cat-${cat}`} className="mb-2 font-display text-lg font-bold">
            {cat}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {list
              .filter((r) => r.category === cat)
              .map((r) => (
                <AchievementCard key={r.code} r={r} />
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function AchievementCard({ r }: { r: AchievementRow }) {
  const got = !!r.unlocked_at;
  const secret = r.hidden && !got;
  const pct = r.threshold ? Math.min(100, Math.round(((r.progress ?? 0) / r.threshold) * 100)) : 0;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-surface p-3",
        got ? "border-ipe-400/70 shadow-sm" : "border-border",
      )}
    >
      <span
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br p-[3px]",
          got ? TIER_RING[r.tier] : "from-border to-border",
        )}
      >
        <span
          className={cn(
            "flex size-full items-center justify-center rounded-full bg-surface text-2xl",
            !got && "opacity-50 grayscale",
          )}
          aria-hidden
        >
          {secret ? <Lock className="size-5 text-muted" /> : r.emoji}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold leading-tight", !got && "text-muted")}>{secret ? "Conquista secreta" : r.title}</p>
        <p className="text-xs text-muted">{secret ? "Continue treinando para descobrir." : r.description}</p>
        {got ? (
          <p className="mt-1 text-[11px] font-semibold text-bandeira-700 dark:text-bandeira-100">
            {TIER_ICON[r.tier]} {TIER_LABEL[r.tier]} · +{TIER_POINTS[r.tier]} · {formatDate(r.unlocked_at!)}
            {r.hidden && " · secreta"}
          </p>
        ) : secret ? (
          <p className="mt-1 text-[11px] text-muted">
            {TIER_ICON[r.tier]} {TIER_LABEL[r.tier]}
          </p>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
              <div className="h-full rounded-full bg-bandeira-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted">
              {shortNumber(Number(r.progress ?? 0))}/{shortNumber(Number(r.threshold ?? 0))} {TIER_ICON[r.tier]}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}
