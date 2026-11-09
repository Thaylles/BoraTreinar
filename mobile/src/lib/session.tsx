import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import type { Tables } from "@/lib/database.types";
import { supabase } from "./supabase";
import { queryClient } from "./query";

export type Profile = Tables<"profiles">;
type Ctx = { ready: boolean; session: Session | null; profile: Profile | null; reloadProfile: () => Promise<void>; signOut: () => Promise<void> };

const SessionContext = createContext<Ctx>({ ready: false, session: null, profile: null, reloadProfile: async () => {}, signOut: async () => {} });
const PROFILE_KEY = "bt:perfil";

export function homeFor(role: Profile["role"] | undefined) {
  return role === "admin" ? "/admin" : role === "personal" ? "/personal" : "/aluno";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) {
      setProfile(data);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(data));
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      if (data.session) {
        // Sem internet: usa o perfil salvo no aparelho.
        const cached = await AsyncStorage.getItem(PROFILE_KEY).catch(() => null);
        if (cached) setProfile(JSON.parse(cached));
        await loadProfile(data.session.user.id).catch(() => {});
      }
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Ao entrar: carrega o perfil antes de liberar as áreas, para o app abrir direto na área certa.
      if (event === "SIGNED_IN" && s) {
        setTimeout(() => void loadProfile(s.user.id).catch(() => {}).finally(() => setSession(s)), 0);
        return;
      }
      setSession(s);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        void AsyncStorage.removeItem(PROFILE_KEY);
        queryClient.clear();
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: Ctx = {
    ready,
    session,
    profile,
    reloadProfile: async () => {
      if (session) await loadProfile(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

/** Perfil garantido (telas logadas). */
export function useProfile() {
  const { profile } = useSession();
  if (!profile) throw new Error("Sem perfil");
  return profile;
}
