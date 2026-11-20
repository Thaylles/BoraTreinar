import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { HC_CATEGORIES, type ExportItem } from "@/lib/health-connect/shared";
import { API_URL } from "./config";
import { supabase } from "./supabase";

/**
 * Health Connect no próprio app: lê corridas/pedais/etc. do celular, manda para o BoraTreinar
 * (/api/saude/sincronizar, a mesma API do app antigo) e grava os treinos do BoraTreinar no
 * Health Connect (para o GymRats e outros contarem).
 */
const TOKEN_KEY = "bt-hc-token";
const USER_KEY = "bt-hc-user";
const LAST_KEY = "bt:hc:ultima";
const RESULT_KEY = "bt:hc:resultado";
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

/** Token deste aparelho, só se pertence a quem está logado agora (trocou de conta: esquece). */
async function healthToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  if (!userId) return null;
  if ((await SecureStore.getItemAsync(USER_KEY)) === userId) return token;
  await forgetHealthToken();
  return null;
}
export const hasHealthToken = async () => !!(await healthToken());

export type HcAccess = { read: boolean; write: boolean };
/** O que o usuário liberou no Health Connect para o BoraTreinar (exercícios). */
export async function healthAccess(): Promise<HcAccess> {
  try {
    const { initialize, getGrantedPermissions } = hc();
    if (!(await initialize())) return { read: false, write: false };
    const g = await getGrantedPermissions();
    const has = (accessType: string) => g.some((p) => p.recordType === "ExerciseSession" && p.accessType === accessType);
    return { read: has("read"), write: has("write") };
  } catch {
    return { read: false, write: false };
  }
}

/** Abre as configurações do Health Connect (para liberar as permissões à mão). */
export function openHealthSettings() {
  try {
    hc().openHealthConnectSettings();
  } catch {
    /* sem Health Connect */
  }
}

const detail = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e ?? "");
  return m ? ` (${m.slice(0, 140)})` : "";
};

/** Conectar: pede as permissões do Health Connect e cria o token deste aparelho (mesma ação do site). */
export async function connectHealth(): Promise<{ error?: string; permission?: boolean }> {
  let access: HcAccess;
  try {
    const { initialize, requestPermission } = hc();
    if (!(await initialize())) return { error: "Health Connect indisponível neste celular." };
    access = await healthAccess();
    if (!access.read || !access.write) {
      await requestPermission([...PERMISSIONS]);
      // Confere o que ficou liberado de verdade (a resposta da janela nem sempre traz tudo).
      access = await healthAccess();
    }
  } catch (e) {
    return { error: `Não foi possível abrir as permissões do Health Connect.${detail(e)}`, permission: true };
  }
  if (!access.read && !access.write) {
    return { error: "O BoraTreinar ainda não tem permissão no Health Connect. Libere \"Exercício\" (ler e gravar) e toque em Conectar de novo.", permission: true };
  }
  if (await hasHealthToken()) return {};
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  if (!userId) return { error: "Entre na sua conta de novo para conectar." };
  // Cria o token deste aparelho direto no banco (RLS: só o dono, até 5 aparelhos). O banco guarda
  // só o hash, igual ao que o site faz em connectHealthApp.
  const token = base64url(Crypto.getRandomBytes(32));
  const tokenHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token, { encoding: Crypto.CryptoEncoding.HEX });
  const { error } = await supabase.from("app_tokens").insert({ token_hash: tokenHash, label: "App Android" });
  if (error) {
    if (/fetch|network/i.test(error.message) && !error.code) return { error: "Sem internet. Tente de novo quando a conexão voltar." };
    if (error.code === "42501") return { error: "Você já tem 5 aparelhos conectados. Desconecte e tente de novo." };
    return { error: `Não foi possível conectar. (${error.code ?? ""} ${error.message})`.slice(0, 200) };
  }
  await SecureStore.setItemAsync(USER_KEY, userId);
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return {};
}

/** Bytes → base64url (o mesmo formato do token criado pelo site). */
function base64url(bytes: Uint8Array): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let k = 0; k < chars; k++) out += abc[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

export async function forgetHealthToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  await AsyncStorage.multiRemove([LAST_KEY, RESULT_KEY]);
}

export type SyncResult = { imported?: number; exported?: number; sent?: number; inHealthConnect?: number | null; error?: string; warning?: string; expired?: boolean };
const iso = (s: string) => new Date(s).toISOString();

/** Lê do Health Connect as atividades dos últimos 30 dias (de outros apps). */
async function readActivities() {
  const { readRecords, aggregateRecord, ExerciseType } = hc();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const now = new Date().toISOString();
  const items = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await readRecords("ExerciseSession", { timeRangeFilter: { operator: "between", startTime: since, endTime: now }, pageToken });
    for (const s of res.records) {
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
    pageToken = res.pageToken;
    if (!pageToken) break;
  }
  return items;
}

type WriteResult = { written: number; failed: number; error: string | null };

/**
 * Grava os treinos do BoraTreinar no Health Connect (um tipo de registro por chamada).
 * Se o lote inteiro for recusado, tenta um por um para não perder os outros e guardar o motivo.
 */
async function writeWorkouts(out: ExportItem[]): Promise<WriteResult> {
  const { insertRecords, ExerciseType } = hc();
  const sessions = out.map((w) => ({
    recordType: "ExerciseSession" as const,
    startTime: iso(w.start),
    endTime: iso(w.end),
    exerciseType: exerciseType(w.category, ExerciseType),
    title: w.title.slice(0, 60),
    metadata: { clientRecordId: `bt-${w.id}`, clientRecordVersion: 2, recordingMethod: 3 },
  }));
  const res = await insertEach(sessions);
  const distances = out
    .filter((w) => w.distance_m)
    .map((w) => ({
      recordType: "Distance" as const,
      startTime: iso(w.start),
      endTime: iso(w.end),
      distance: { unit: "meters" as const, value: w.distance_m! },
      metadata: { clientRecordId: `bt-d-${w.id}`, clientRecordVersion: 2, recordingMethod: 3 },
    }));
  if (distances.length) await insertEach(distances).catch(() => null); // sem permissão de distância: o treino já foi
  return res;

  async function insertEach(records: object[]): Promise<WriteResult> {
    if (!records.length) return { written: 0, failed: 0, error: null };
    try {
      await insertRecords(records as never);
      return { written: records.length, failed: 0, error: null };
    } catch (batchError) {
      let written = 0;
      let error: string | null = null;
      for (const r of records) {
        try {
          await insertRecords([r] as never);
          written++;
        } catch (e) {
          error ??= e instanceof Error ? e.message : String(e);
        }
      }
      return { written, failed: records.length - written, error: error ?? (batchError instanceof Error ? batchError.message : String(batchError)) };
    }
  }
}

/** Quantos treinos gravados pelo BoraTreinar estão no Health Connect (últimos 30 dias). */
export async function countOwnWorkouts(): Promise<number | null> {
  try {
    const { initialize, readRecords } = hc();
    if (!(await initialize())) return null;
    const since = new Date(Date.now() - 31 * 86_400_000).toISOString();
    const res = await readRecords("ExerciseSession", {
      timeRangeFilter: { operator: "between", startTime: since, endTime: new Date().toISOString() },
      dataOriginFilter: ["com.boratreinar.app"],
      pageSize: 500,
    });
    return res.records.length;
  } catch {
    return null;
  }
}

/** Resultado da última sincronização (para a tela mostrar mesmo depois de fechar o app). */
export type LastSync = { at: number; imported: number; exported: number; sent: number; inHealthConnect: number | null; warning?: string };
export async function lastSyncResult(): Promise<LastSync | null> {
  try {
    return JSON.parse((await AsyncStorage.getItem(RESULT_KEY)) ?? "null");
  } catch {
    return null;
  }
}

/** Abre a tela do Health Connect com os dados que o BoraTreinar gravou. */
export function openHealthData() {
  try {
    hc().openHealthConnectDataManagement();
  } catch {
    openHealthSettings();
  }
}

/** Sincroniza os últimos 30 dias nos dois sentidos. */
export async function syncHealth(): Promise<SyncResult> {
  const token = await healthToken();
  if (!token) return { error: "Conecte o Health Connect primeiro." };
  const access = await healthAccess();
  if (!access.read && !access.write) return { error: "O BoraTreinar está sem permissão no Health Connect. Toque em Conectar de novo." };
  const warnings: string[] = [];
  let items: Awaited<ReturnType<typeof readActivities>> = [];
  if (access.read) {
    try {
      items = await readActivities();
    } catch (e) {
      warnings.push(`Não deu para ler as atividades do Health Connect.${detail(e)}`);
    }
  } else warnings.push("Sem permissão para ler os exercícios: suas corridas e pedais não entram no BoraTreinar.");

  const res = await fetch(`${API_URL}/api/saude/sincronizar`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
  }).catch(() => null);
  if (!res) return { error: "Sem internet. Tente de novo quando a conexão voltar." };
  const body = (await res.json().catch(() => ({}))) as { imported?: number; export?: ExportItem[]; error?: string };
  if (!res.ok) {
    if (res.status !== 401) return { error: body.error ?? `Não foi possível sincronizar (erro ${res.status}).` };
    await forgetHealthToken();
    return { error: "A conexão deste celular expirou. Toque em Conectar de novo.", expired: true };
  }
  const out = body.export ?? [];
  let exported = 0;
  if (!access.write) warnings.push("Sem permissão para gravar exercícios: seus treinos não vão para o Health Connect.");
  else if (out.length) {
    try {
      const w = await writeWorkouts(out);
      exported = w.written;
      if (w.failed) warnings.push(`O Health Connect recusou ${w.failed} de ${out.length} treino(s).${w.error ? ` (${w.error.slice(0, 140)})` : ""}`);
    } catch (e) {
      warnings.push(`Não deu para gravar os treinos no Health Connect.${detail(e)}`);
    }
  }
  const inHealthConnect = access.read ? await countOwnWorkouts() : null;
  const result: LastSync = { at: Date.now(), imported: body.imported ?? 0, exported, sent: out.length, inHealthConnect, warning: warnings.join(" ") || undefined };
  await AsyncStorage.setItem(LAST_KEY, String(result.at));
  await AsyncStorage.setItem(RESULT_KEY, JSON.stringify(result));
  return result;
}

let running: Promise<SyncResult | null> | null = null;
/**
 * Sincronização automática (ao abrir o app e depois de salvar um treino), sem incomodar:
 * só roda se este celular já está conectado e, sem `force`, no máximo a cada 15 minutos.
 */
export function autoSyncHealth(force = false): Promise<SyncResult | null> {
  if (Platform.OS !== "android") return Promise.resolve(null);
  running ??= (async () => {
    try {
      if (!(await hasHealthToken())) return null;
      const last = Number(await AsyncStorage.getItem(LAST_KEY)) || 0;
      if (!force && Date.now() - last < 15 * 60_000) return null;
      if ((await healthConnectStatus()) !== "ok") return null;
      return await syncHealth();
    } catch {
      return null;
    } finally {
      running = null;
    }
  })();
  return running;
}
