import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { createClient as create, processLock } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Cliente único do Supabase no app; a sessão fica salva no aparelho. */
export const supabase = create<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Sem internet o app continua usando a sessão salva (o RLS valida tudo no servidor ao sincronizar).
const getUserOnline = supabase.auth.getUser.bind(supabase.auth);
supabase.auth.getUser = async (jwt?: string) => {
  if (jwt) return getUserOnline(jwt);
  const res = await getUserOnline().catch(() => null);
  if (res && !res.error) return res;
  const { data } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null }, error: null } as Awaited<ReturnType<typeof getUserOnline>>;
};

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Mesmo formato do createClient do site, para reaproveitar src/lib/*-server.ts. */
export async function createClient() {
  return supabase;
}
