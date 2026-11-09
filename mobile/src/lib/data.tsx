import { RefreshControl } from "react-native";
import { useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { useTheme } from "~/ui/theme";

/**
 * Dados de uma tela: carrega com as mesmas funções do site (lib/*-server) e fica salvo no aparelho,
 * então a tela abre na hora e funciona sem internet com a última versão.
 */
export function useData<T>(key: QueryKey, fn: () => Promise<T>, opts: Omit<UseQueryOptions<T>, "queryKey" | "queryFn"> = {}) {
  return useQuery<T>({ queryKey: key, queryFn: fn, ...opts });
}

/** "Puxar para atualizar" ligado a uma ou mais consultas. */
export function useRefresh(...queries: { refetch: () => Promise<unknown>; isRefetching: boolean }[]) {
  const t = useTheme();
  return (
    <RefreshControl
      refreshing={queries.some((q) => q.isRefetching)}
      onRefresh={() => void Promise.all(queries.map((q) => q.refetch()))}
      colors={[t.bandeira500]}
      tintColor={t.bandeira500}
      progressBackgroundColor={t.surface}
    />
  );
}
