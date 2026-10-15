export type Tier = "bronze" | "prata" | "ouro" | "platina";

/** Pontos por conquista (como troféus de console). */
export const TIER_POINTS: Record<Tier, number> = { bronze: 15, prata: 30, ouro: 90, platina: 180 };
export const TIER_LABEL: Record<Tier, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro", platina: "Platina" };
export const TIER_ICON: Record<Tier, string> = { bronze: "🥉", prata: "🥈", ouro: "🥇", platina: "💎" };

export type AchievementRow = {
  code: string;
  title: string | null;
  description: string | null;
  emoji: string;
  category: string;
  tier: Tier;
  hidden: boolean;
  unlocked_at: string | null;
  progress: number | null;
  threshold: number | null;
  sort: number;
};

export function achievementStats(rows: AchievementRow[]) {
  const unlocked = rows.filter((r) => r.unlocked_at);
  const byTier = (["bronze", "prata", "ouro", "platina"] as Tier[]).map((t) => ({
    tier: t,
    got: unlocked.filter((r) => r.tier === t).length,
    total: rows.filter((r) => r.tier === t).length,
  }));
  return {
    total: rows.length,
    unlocked: unlocked.length,
    hiddenLeft: rows.filter((r) => r.hidden && !r.unlocked_at).length,
    points: unlocked.reduce((s, r) => s + TIER_POINTS[r.tier], 0),
    maxPoints: rows.reduce((s, r) => s + TIER_POINTS[r.tier], 0),
    byTier,
  };
}

/** Número curto para progresso: 12500 → "12,5 mil". */
export function shortNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 10_000) return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
