import { useState } from "react";
import { router } from "expo-router";
import { callAction, form, OfflineError } from "./api";
import { queryClient } from "./query";

type State = { error?: string; ok?: string } | null;

/**
 * Envia uma ação do servidor no estilo "formulário" do site (estado anterior + campos),
 * guarda o retorno ({ error } / { ok }) e segue redirecionamentos.
 */
export function useFormAction(action: string, opts: { onRedirect?: (to: string) => boolean | void; invalidate?: boolean } = {}) {
  const [state, setState] = useState<State>(null);
  const [pending, setPending] = useState(false);
  async function submit(fields: Parameters<typeof form>[0]) {
    setPending(true);
    try {
      const r = await callAction<State>(action, null, form(fields));
      if (r.error) setState({ error: r.error });
      else setState(r.result ?? null);
      if (opts.invalidate !== false && !r.error) await queryClient.invalidateQueries();
      if (r.redirect && !opts.onRedirect?.(r.redirect)) navigateWeb(r.redirect);
      return r;
    } catch (e) {
      setState({ error: e instanceof OfflineError ? e.message : "Algo deu errado. Tenta de novo?" });
      return null;
    } finally {
      setPending(false);
    }
  }
  return { state, setState, pending, submit };
}

/** Ação com argumentos simples (ex.: addWater(500)). */
export function useCall(action: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T = unknown>(...args: unknown[]) {
    setPending(true);
    setError(null);
    try {
      const r = await callAction<T>(action, ...args);
      if (r.error) setError(r.error);
      else await queryClient.invalidateQueries();
      if (r.redirect) navigateWeb(r.redirect);
      return r;
    } catch (e) {
      setError(e instanceof OfflineError ? e.message : "Algo deu errado. Tenta de novo?");
      return null;
    } finally {
      setPending(false);
    }
  }
  return { run, pending, error, setError };
}

/**
 * As ações do site redirecionam para rotas web ("/aluno?salvo=1"). As rotas do app têm os mesmos
 * caminhos, então dá para seguir direto; a query string vira parâmetros da tela.
 */
export function navigateWeb(to: string) {
  if (!to.startsWith("/")) return;
  const path = to.split("#")[0];
  try {
    router.replace(path as never);
  } catch {
    router.replace("/");
  }
}
