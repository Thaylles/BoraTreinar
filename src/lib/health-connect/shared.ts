/** Health Connect (app Android): partes usadas pelo site e pela API. Funções puras. */

export const ANDROID_PACKAGE = "com.boratreinar.app";

/** Categorias que o app Android envia (a partir do tipo de exercício do Health Connect). */
export const HC_CATEGORIES = [
  "corrida",
  "caminhada",
  "esteira",
  "bike",
  "bike_ergometrica",
  "eliptico",
  "natacao",
  "remo",
  "escada",
  "outro_cardio",
  "musculacao",
  "outro",
] as const;
export type HcCategory = (typeof HC_CATEGORIES)[number];

/** Exercício do catálogo → categoria para escrever no Health Connect (o que não é cardio vira musculação). */
const CARDIO_BY_NAME: Record<string, HcCategory> = {
  "Corrida ao ar livre": "corrida",
  Caminhada: "caminhada",
  Esteira: "esteira",
  "Pedal ao ar livre": "bike",
  "Bicicleta ergométrica": "bike_ergometrica",
  Elíptico: "eliptico",
  Natação: "natacao",
  "Remo ergômetro": "remo",
  "Escada / stepper": "escada",
  "Outro cardio": "outro_cardio",
};

export type ExportSet = { done: boolean; distance_km: number | null; equipment: { name: string; muscle_group: string } | null };
export type ExportItem = { id: string; title: string; start: string; end: string; category: HcCategory; distance_m: number | null };

/** Treino do BoraTreinar → atividade para o Health Connect (só séries feitas contam). */
export function toExportItem(s: { id: string; plan_name: string | null; started_at: string; finished_at: string; sets: ExportSet[] }): ExportItem | null {
  const done = s.sets.filter((x) => x.done && x.equipment);
  if (!done.length || Date.parse(s.finished_at) <= Date.parse(s.started_at)) return null;
  const cardio = done.every((x) => x.equipment!.muscle_group === "cardio");
  const first = done[0].equipment!.name;
  const km = done.reduce((a, x) => a + Number(x.distance_km ?? 0), 0);
  return {
    id: s.id,
    title: s.plan_name?.trim() || (cardio ? first : "Treino de musculação"),
    start: s.started_at,
    end: s.finished_at,
    category: cardio ? (CARDIO_BY_NAME[first] ?? "outro_cardio") : "musculacao",
    distance_m: cardio && km > 0 ? Math.round(km * 1000) : null,
  };
}

/** Link que abre a tela de sincronização do app Android (token só na primeira conexão). */
export function syncIntentUrl(origin: string, token?: string): string {
  const q = new URLSearchParams({ api: origin, ...(token ? { token } : {}) });
  const fallback = encodeURIComponent(`${origin}/aluno/saude-conectada?sem-app=1`);
  return `intent://sync?${q}#Intent;scheme=boratreinar;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}
