/** Última versão publicada do app Android (Releases do GitHub, geradas pelo fluxo "App Android (APK)"). */
export type AppRelease = { versionName: string; versionCode: number; url: string; publishedAt: string; sizeMb: number | null };

const REPO = process.env.APP_RELEASES_REPO || "Thaylles/BoraTreinar";
type GhRelease = { tag_name: string; draft: boolean; prerelease: boolean; published_at: string; assets: { name: string; size: number; browser_download_url: string }[] };

/** Tag "app-v2.0.2-105" → { versionName: "2.0.2", versionCode: 105 }. */
export function parseAppTag(tag: string): { versionName: string; versionCode: number } | null {
  const m = /^app-v(.+)-(\d+)$/.exec(tag);
  return m ? { versionName: m[1], versionCode: Number(m[2]) } : null;
}

/** A release com o maior versionCode que tenha um .apk. */
export function pickLatest(releases: GhRelease[]): AppRelease | null {
  let best: AppRelease | null = null;
  for (const r of releases) {
    const v = parseAppTag(r.tag_name);
    const apk = r.assets.find((a) => a.name.toLowerCase().endsWith(".apk"));
    if (!v || !apk || r.draft || r.prerelease) continue;
    if (!best || v.versionCode > best.versionCode) {
      best = { ...v, url: apk.browser_download_url, publishedAt: r.published_at, sizeMb: apk.size ? Math.round(apk.size / 1_048_576) : null };
    }
  }
  return best;
}

/**
 * Reserva sem a API (que tem limite de chamadas por IP): /releases/latest redireciona para a tag,
 * e o nome do arquivo segue o padrão do fluxo (BoraTreinar-<versão>-<versionCode>.apk).
 */
async function latestByRedirect(): Promise<AppRelease | null> {
  const res = await fetch(`https://github.com/${REPO}/releases/latest`, { method: "HEAD", redirect: "manual", next: { revalidate: 300 } } as RequestInit);
  const tag = decodeURIComponent(res.headers.get("location")?.split("/releases/tag/")[1] ?? "");
  const v = parseAppTag(tag);
  if (!v) return null;
  return { ...v, url: `https://github.com/${REPO}/releases/download/${tag}/BoraTreinar-${v.versionName}-${v.versionCode}.apk`, publishedAt: "", sizeMb: null };
}

export async function latestAppRelease(): Promise<AppRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: { accept: "application/vnd.github+json" },
      // Cache de 5 min no servidor do site (opção do Next; o app nativo só usa os tipos deste arquivo).
      next: { revalidate: 300 },
    } as RequestInit);
    if (res.ok) return pickLatest((await res.json()) as GhRelease[]);
    return await latestByRedirect();
  } catch {
    return null;
  }
}
