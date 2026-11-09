import { Alert, Platform } from "react-native";

/** confirm() do site: pergunta e devolve true/false. */
export function confirmAsk(message: string, opts: { title?: string; ok?: string; destructive?: boolean } = {}): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert(opts.title ?? "Confirmar", message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: opts.ok ?? "OK", style: opts.destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
