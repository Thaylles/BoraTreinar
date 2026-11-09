import { useEffect, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { AppState } from "react-native";
import { flushQueue } from "./api";

/** Dados ficam guardados no aparelho: sem internet o app mostra a última versão carregada. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: "offlineFirst", gcTime: 1000 * 60 * 60 * 24 * 14, staleTime: 1000 * 30, retry: 1 },
    mutations: { networkMode: "offlineFirst" },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "bt:cache" });

onlineManager.setEventListener((setOnline) => {
  const sub = Network.addNetworkStateListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false));
  return () => sub.remove();
});

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const app = AppState.addEventListener("change", (s) => {
      focusManager.setFocused(s === "active");
      if (s === "active") void flushQueue().then((n) => n && queryClient.invalidateQueries());
    });
    const unsub = onlineManager.subscribe((online) => {
      if (online) void flushQueue().then((n) => n && queryClient.invalidateQueries());
    });
    return () => {
      app.remove();
      unsub();
    };
  }, []);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 14 }}>
      {children}
    </PersistQueryClientProvider>
  );
}
