import { Linking, Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL } from "./config";
import { supabase } from "./supabase";

/** Baixa um arquivo das rotas do site (PDF/CSV da ficha, relatórios) e abre "Compartilhar/Salvar". */
export async function downloadAndShare(path: string, filename: string, mimeType: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (Platform.OS === "web") return void Linking.openURL(`${API_URL}${path}`);
  const dir = new Directory(Paths.cache, "downloads");
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, filename);
  if (dest.exists) dest.delete();
  const file = await File.downloadFileAsync(`${API_URL}${path}`, dest, { headers: token ? { authorization: `Bearer ${token}` } : {}, idempotent: true });
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}
