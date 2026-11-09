import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";
import { supabase } from "./supabase";

/**
 * Chama uma ação do servidor do site ("modulo#funcao") pela ponte /api/mobile/action.
 * As regras, e-mails, IA e permissões são as mesmas do site.
 */
export type ActionResponse<T = unknown> = { result?: T; redirect?: string; notFound?: boolean; error?: string };

export class OfflineError extends Error {
  constructor() {
    super("Sem internet. Tente de novo quando a conexão voltar.");
  }
}

export async function callAction<T = unknown>(action: string, ...args: unknown[]): Promise<ActionResponse<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/mobile/action`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, args }),
    });
  } catch {
    throw new OfflineError();
  }
  const body = (await res.json().catch(() => ({}))) as ActionResponse<T>;
  if (!res.ok && !body.error) body.error = "Algo deu errado. Tenta de novo?";
  return body;
}

/** Campos de formulário (o servidor transforma em FormData). */
export type FormFile = { __file: { name: string; type: string; base64: string } };
export const form = (fields: Record<string, string | number | boolean | string[] | FormFile | null | undefined>) => {
  const out: Record<string, string | string[] | FormFile | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === false) continue;
    out[k] = v === true ? "on" : Array.isArray(v) || typeof v === "object" ? (v as string[] | FormFile) : String(v);
  }
  return { __form: out };
};

/** Ação no estilo useActionState do site: (estadoAnterior, formData) → { error?, ok? }. */
export async function formAction(action: string, fields: Parameters<typeof form>[0]) {
  const r = await callAction<{ error?: string; ok?: string } | null>(action, null, form(fields));
  return { state: r.result ?? (r.error ? { error: r.error } : null), redirect: r.redirect, notFound: r.notFound };
}

// ─── Fila offline: ações enviadas quando a internet voltar ──────────────
const QUEUE_KEY = "bt:fila-acoes";
type Queued = { id: string; action: string; args: unknown[]; label: string; at: string };

async function readQueue(): Promise<Queued[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? "[]");
  } catch {
    return [];
  }
}
async function writeQueue(q: Queued[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

/** Tenta agora; sem internet, guarda na fila e devolve { queued: true }. */
export async function callOrQueue<T = unknown>(label: string, action: string, ...args: unknown[]) {
  try {
    return { ...(await callAction<T>(action, ...args)), queued: false };
  } catch (e) {
    if (!(e instanceof OfflineError)) throw e;
    const q = await readQueue();
    q.push({ id: `${Date.now()}-${Math.random()}`, action, args, label, at: new Date().toISOString() });
    await writeQueue(q);
    return { queued: true } as ActionResponse<T> & { queued: boolean };
  }
}

export async function pendingActions() {
  return readQueue();
}

let flushing = false;
/** Envia o que ficou na fila. Devolve quantas foram enviadas. */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of await readQueue()) {
      try {
        await callAction(item.action, ...item.args);
      } catch (e) {
        if (e instanceof OfflineError) break;
      }
      sent++;
      await writeQueue((await readQueue()).filter((x) => x.id !== item.id));
    }
  } finally {
    flushing = false;
  }
  return sent;
}
