import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";

export const pushConfigured = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready || !pushConfigured) return pushConfigured;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `${appUrl.startsWith("https") ? appUrl : "mailto:contato@boratreinar.app"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ready = true;
  return true;
}

export type PushMessage = { title: string; body?: string | null; link?: string | null; tag?: string };

/** Envia o push para todos os aparelhos inscritos da pessoa; remove inscrições expiradas. */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<number> {
  if (!setup()) return 0;
  const db = createAdminClient();
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  const expired: string[] = [];
  const payload = JSON.stringify({ title: msg.title, body: msg.body ?? "", link: msg.link ?? "/", tag: msg.tag });
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(s.id);
        else console.error("Falha no push:", status ?? e);
      }
    }),
  );
  if (expired.length) await db.from("push_subscriptions").delete().in("id", expired);
  return sent;
}
