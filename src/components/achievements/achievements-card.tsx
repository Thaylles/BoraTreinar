import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { achievementStats, type AchievementRow } from "@/lib/achievements";

/** Atalho para a sala de troféus, com as últimas conquistas liberadas. */
export function AchievementsCard({ rows, href }: { rows: AchievementRow[]; href: string }) {
  if (!rows.length) return null;
  const stats = achievementStats(rows);
  const recent = rows
    .filter((r) => r.unlocked_at)
    .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""))
    .slice(0, 5);
  return (
    <Link
      href={href}
      className="mb-4 flex items-center gap-3 rounded-3xl border border-border bg-surface p-4 transition hover:border-bandeira-500"
    >
      <span className="text-3xl" aria-hidden>
        🏆
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold">
          Conquistas {stats.unlocked}/{stats.total}
        </span>
        <span className="block truncate text-sm text-muted">
          {recent.length ? `Últimas: ${recent.map((r) => r.emoji).join(" ")}` : "Treine para liberar a primeira!"} · {stats.points} pts
        </span>
      </span>
      <ChevronRight className="size-5 text-muted" aria-hidden />
    </Link>
  );
}
