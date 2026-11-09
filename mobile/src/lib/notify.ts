import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/** Avisos locais (fim do descanso, cronômetro do cardio): tocam e vibram mesmo com o app no fundo. */
let configured = false;
export async function setupLocalNotifications() {
  if (configured || Platform.OS === "web") return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("descanso", {
      name: "Descanso e cronômetro do treino",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 120, 300, 120, 500],
      sound: "default",
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync("geral", { name: "Avisos do BoraTreinar", importance: Notifications.AndroidImportance.DEFAULT });
  }
}

export async function ensureNotificationPermission() {
  if (Platform.OS === "web") return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Agenda um aviso daqui a `seconds` e devolve o id (para cancelar se o usuário pular). */
export async function scheduleAlarm(seconds: number, title: string, body: string): Promise<string | null> {
  if (Platform.OS === "web" || seconds <= 0) return null;
  try {
    await setupLocalNotifications();
    if (!(await ensureNotificationPermission())) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: "descanso" },
    });
  } catch {
    return null;
  }
}

export async function cancelAlarm(id: string | null | undefined) {
  if (!id || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* já disparou */
  }
}
