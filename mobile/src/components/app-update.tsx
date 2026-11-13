import { Linking, Pressable } from "react-native";
import Constants from "expo-constants";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react-native";
import type { AppRelease } from "@/lib/app-release";
import { API_URL } from "~/lib/config";
import { Text, useTheme } from "~/ui";

/** versionCode deste APK (o fluxo do GitHub grava no app.json antes de compilar). */
const CURRENT = Number(Constants.expoConfig?.android?.versionCode) || 0;

/** Aviso de versão nova do app: compara com a última Release e abre o download. */
export function AppUpdate() {
  const t = useTheme();
  const { data } = useQuery({
    queryKey: ["app-versao"],
    staleTime: 30 * 60_000,
    queryFn: async () => (await (await fetch(`${API_URL}/api/app/versao`)).json()) as Partial<AppRelease>,
  });
  if (!CURRENT || !data?.url || !data.versionCode || data.versionCode <= CURRENT) return null;
  return (
    <Pressable onPress={() => void Linking.openURL(data.url!)} className="mb-4 flex-row items-center gap-3 rounded-2xl border-2 border-ipe-500 bg-ipe-100/60 px-4 py-3 dark:bg-ipe-500/10">
      <Download color={t.dark ? t.ipe400 : t.anil900} size={20} />
      <Text className="flex-1 text-sm">
        <Text className="text-sm font-bold">Nova versão do app ({data.versionName}). </Text>
        Toque para baixar e instale por cima, sem desinstalar.
      </Text>
    </Pressable>
  );
}
