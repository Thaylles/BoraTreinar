import { Redirect } from "expo-router";

/**
 * "boratreinar://sync" é o link que o site usa em "Sincronizar agora" (Health Connect).
 * O app cria a própria conexão com o login atual; tokens que venham no link são ignorados.
 */
export default function SyncLink() {
  return <Redirect href="/aluno/saude-conectada?auto=1" />;
}
