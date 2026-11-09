import { useEffect, useState } from "react";
import { AppState, Linking, Platform, Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { router } from "expo-router";
import { Bell, BellOff } from "lucide-react-native";
import { supabase } from "~/lib/supabase";
import { ensureNotificationPermission, setupLocalNotifications } from "~/lib/notify";
import { Text, useTheme } from "~/ui";

/**
 * Avisos no celular: tudo o que o site manda por push (água, dia de treino, ficha nova, aulas,
 * Personal) passa pela tabela de notificações. O app confere as novas em segundo plano
 * (Android: a cada ~15 min) e ao abrir, e mostra como notificação do aparelho.
 */
const TASK = "bt-avisos";
const ON_KEY = "bt:avisos:ligado";
const SEEN_KEY = "bt:avisos:visto";

/** Rotas do site ("/aluno#agua") viram rotas do app. */
export function appLink(link: string | null | undefined) {
  if (!link || !link.startsWith("/")) return null;
  return link.split("#")[0] || "/";
}

export async function checkNewNotifications(): Promise<number> {
  if ((await AsyncStorage.getItem(ON_KEY)) !== "1") return 0;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return 0;
  const seen = (await AsyncStorage.getItem(SEEN_KEY)) ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, link, created_at")
    .eq("user_id", sess.session.user.id)
    .is("read_at", null)
    .gt("created_at", seen)
    .order("created_at", { ascending: true })
    .limit(5);
  if (error || !data?.length) return 0;
  await setupLocalNotifications();
  for (const n of data)
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body ?? undefined, data: { link: appLink(n.link) }, sound: "default" },
      trigger: Platform.OS === "android" ? { channelId: "geral" } : null,
    });
  await AsyncStorage.setItem(SEEN_KEY, data[data.length - 1].created_at);
  return data.length;
}

if (Platform.OS !== "web") {
  TaskManager.defineTask(TASK, async () => {
    try {
      await checkNewNotifications();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

async function enable() {
  if (!(await ensureNotificationPermission())) return false;
  await setupLocalNotifications();
  await AsyncStorage.multiSet([
    [ON_KEY, "1"],
    [SEEN_KEY, (await AsyncStorage.getItem(SEEN_KEY)) ?? new Date().toISOString()],
  ]);
  try {
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  } catch {
    /* sem segundo plano: confere ao abrir o app */
  }
  return true;
}

async function disable() {
  await AsyncStorage.setItem(ON_KEY, "0");
  try {
    await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {
    /* não estava registrada */
  }
}

/** No início do app: confere avisos ao voltar para o app e abre a tela certa ao tocar num aviso. */
export function useDeviceNotifications(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || Platform.OS === "web") return;
    void (async () => {
      if ((await AsyncStorage.getItem(ON_KEY)) === "1") {
        await setupLocalNotifications();
        await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 }).catch(() => {});
        await checkNewNotifications().catch(() => {});
      }
    })();
    const app = AppState.addEventListener("change", (s) => s === "active" && void checkNewNotifications().catch(() => {}));
    const open = (r: Notifications.NotificationResponse | null) => {
      const link = r?.notification.request.content.data?.link;
      if (typeof link === "string") setTimeout(() => router.push(link as never), 50);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      app.remove();
      sub.remove();
    };
  }, [signedIn]);
}

/** Cartão "Receba avisos no celular" (no lugar do push do site). */
export function NotificationsCard() {
  const t = useTheme();
  const [state, setState] = useState<"loading" | "on" | "off" | "denied">("loading");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    void (async () => {
      const perm = await Notifications.getPermissionsAsync();
      const on = (await AsyncStorage.getItem(ON_KEY)) === "1";
      setState(perm.granted ? (on ? "on" : "off") : !perm.canAskAgain && perm.status === "denied" ? "denied" : "off");
    })();
  }, []);
  if (state === "loading") return null;
  async function toggle() {
    setPending(true);
    try {
      if (state === "on") {
        await disable();
        setState("off");
      } else if (state === "denied") void Linking.openSettings();
      else setState((await enable()) ? "on" : "denied");
    } finally {
      setPending(false);
    }
  }
  return (
    <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      {state === "on" ? <Bell color={t.bandeira500} size={20} /> : <BellOff color={t.muted} size={20} />}
      <Text className="min-w-0 flex-1 text-sm">
        {state === "on"
          ? "Notificações no celular ativadas."
          : state === "denied"
            ? "Notificações bloqueadas. Libere nas configurações do celular."
            : "Receba avisos de treino, água, ficha nova e aulas no celular."}
      </Text>
      <Pressable
        disabled={pending}
        onPress={toggle}
        className={state === "on" ? "rounded-xl px-3 py-1.5" : "rounded-xl bg-bandeira-500 px-3 py-1.5"}
      >
        <Text className={state === "on" ? "text-sm font-semibold text-muted" : "text-sm font-bold text-white"}>
          {state === "on" ? "Desativar" : state === "denied" ? "Abrir ajustes" : "Ativar"}
        </Text>
      </Pressable>
    </View>
  );
}
