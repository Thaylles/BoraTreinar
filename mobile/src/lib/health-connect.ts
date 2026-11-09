import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { HC_CATEGORIES, type ExportItem } from "@/lib/health-connect/shared";
import { callAction } from "./api";
import { API_URL } from "./config";

/**
 * Health Connect no próprio app: lê corridas/pedais/etc. do celular, manda para o BoraTreinar
 * (/api/saude/sincronizar, a mesma API do app antigo) e grava os treinos do BoraTreinar no
 * Health Connect (para o GymRats e outros contarem).
 */
const TOKEN_KEY = "bt-hc-token";
type HC = typeof import("react-native-health-connect");
const hc = (): HC => require("react-native-health-connect");

const PERMISSIONS = [
  { accessType: "read", recordType: "ExerciseSession" },
  { accessType: "write", recordType: "ExerciseSession" },
  { accessType: "read", recordType: "Distance" },
  { accessType: "write", recordType: "Distance" },
] as const;

function category(type: number, T: HC["ExerciseType"]): string {
  const m: [number[], string][] = [
    [[T.RUNNING], "corrida"],
    [[T.RUNNING_TREADMILL], "esteira"],
    [[T.WALKING, T.HIKING], "caminhada"],
    [[T.BIKING], "bike"],
    [[T.BIKING_STATIONARY], "bike_ergometrica"],
    [[T.ELLIPTICAL], "eliptico"],
    [[T.SWIMMING_POOL, T.SWIMMING_OPEN_WATER], "natacao"],
    [[T.ROWING_MACHINE, T.ROWING], "remo"],
    [[T.STAIR_CLIMBING, T.STAIR_CLIMBING_MACHINE], "escada"],
    [[T.STRENGTH_TRAINING, T.WEIGHTLIFTING, T.CALISTHENICS], "musculacao"],
    [[T.HIGH_INTENSITY_INTERVAL_TRAINING, T.DANCING, T.BOXING, T.MARTIAL_ARTS, T.SOCCER, T.BASKETBALL, T.VOLLEYBALL, T.TENNIS], "outro_cardio"],
  ];
  return m.find(([types]) => types.includes(type))?.[1] ?? "outro";
}
function exerciseType(cat: string, T: HC["ExerciseType"]): number {
  const m: Record<string, number> = {
    corrida: T.RUNNING,
    esteira: T.RUNNING_TREADMILL,
    caminhada: T.WALKING,
    bike: T.BIKING,
    bike_ergometrica: T.BIKING_STATIONARY,
    eliptico: T.ELLIPTICAL,
    natacao: T.SWIMMING_POOL,
    remo: T.ROWING_MACHINE,
    escada: T.STAIR_CLIMBING_MACHINE,
    musculacao: T.STRENGTH_TRAINING,
  };
  return m[cat] ?? T.OTHER_WORKOUT;
}

export type HcStatus = "indisponivel" | "instalar" | "ok";
export async function healthConnectStatus(): Promise<HcStatus> {
  if (Platform.OS !== "android") return "indisponivel";
  try {
    const { getSdkStatus, SdkAvailabilityStatus } = hc();
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return "ok";
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return "instalar";
    return "indisponivel";
  } catch {
    return "indisponivel";
  }
}

export const hasHealthToken = async () => !!(await SecureStore.getItemAsync(TOKEN_KEY));

/** Conectar: cria o token do aparelho (mesma ação do site) e pede as permissões do Health Connect. */
export async function connectHealth(): Promise<{ error?: string }> {
  const { initialize, requestPermission } = hc();
  if (!(await initialize())) return { error: "Health Connect indisponível neste celular." };
  const granted = await requestPermission([...PERMISSIONS]);
  if (!granted.some((p) => p.recordType === "ExerciseSession" && p.accessType === "read")) return { error: "Permita o acesso aos exercícios no Health Connect para sincronizar." };
  const r = await callAction<{ url?: string; error?: string }>("aluno/saude-conectada#connectHealthApp");
  const url = r.result?.url;
  const token = url ? new URLSearchParams(url.slice(url.indexOf("?") + 1, url.indexOf("#"))).get("token") : null;
  if (!token) return { error: r.result?.error ?? r.error ?? "Não foi possível conectar." };
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return {};
}

export async function forgetHealthToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Sincroniza os últimos 30 dias nos dois sentidos. */
export async function syncHealth(): Promise<{ imported?: number; exported?: number; error?: string }> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return { error: "Conecte o Health Connect primeiro." };
  const { initialize, readRecords, aggregateRecord, insertRecords, ExerciseType } = hc();
  if (!(await initialize())) return { error: "Health Connect indisponível neste celular." };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const now = new Date().toISOString();
  const { records } = await readRecords("ExerciseSession", { timeRangeFilter: { operator: "between", startTime: since, endTime: now } });
  const items = [];
  for (const s of records) {
    const origin = s.metadata?.dataOrigin ?? null;
    if (origin === "com.boratreinar.app" || s.metadata?.clientRecordId?.startsWith("bt-")) continue;
    let distance_m: number | null = null;
    try {
      const agg = await aggregateRecord({ recordType: "Distance", timeRangeFilter: { operator: "between", startTime: s.startTime, endTime: s.endTime } });
      distance_m = agg.DISTANCE?.inMeters ? Math.round(agg.DISTANCE.inMeters) : null;
    } catch {
      /* sem permissão de distância */
    }
    const cat = category(s.exerciseType, ExerciseType);
    items.push({ id: s.metadata?.id ?? `${s.startTime}`, category: HC_CATEGORIES.includes(cat as never) ? cat : "outro", start: s.startTime, end: s.endTime, distance_m, title: s.title ?? null, origin });
  }
  const res = await fetch(`${API_URL}/api/saude/sincronizar`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
  }).catch(() => null);
  if (!res) return { error: "Sem internet. Tente de novo quando a conexão voltar." };
  const body = (await res.json().catch(() => ({}))) as { imported?: number; export?: ExportItem[]; error?: string };
  if (!res.ok) {
    if (res.status === 401) await forgetHealthToken();
    return { error: body.error ?? "Não foi possível sincronizar." };
  }
  const out = body.export ?? [];
  const toWrite = out.flatMap((w) => [
    {
      recordType: "ExerciseSession" as const,
      startTime: w.start,
      endTime: w.end,
      exerciseType: exerciseType(w.category, ExerciseType),
      title: w.title,
      metadata: { clientRecordId: `bt-${w.id}`, clientRecordVersion: 1, recordingMethod: 3 },
    },
    ...(w.distance_m
      ? [
          {
            recordType: "Distance" as const,
            startTime: w.start,
            endTime: w.end,
            distance: { unit: "meters" as const, value: w.distance_m },
            metadata: { clientRecordId: `bt-d-${w.id}`, clientRecordVersion: 1, recordingMethod: 3 },
          },
        ]
      : []),
  ]);
  if (toWrite.length) await insertRecords(toWrite as never);
  return { imported: body.imported ?? 0, exported: out.length };
}
