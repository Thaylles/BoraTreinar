import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { RefreshCw, Smartphone } from "lucide-react-native";
import { formatDateTime } from "@/lib/format";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { connectHealth, forgetHealthToken, hasHealthToken, healthConnectStatus, syncHealth, type HcStatus } from "~/lib/health-connect";
import { queryClient } from "~/lib/query";
import { supabase } from "~/lib/supabase";
import { useCall } from "~/lib/use-action";
import { Alert, Button, Card, Loading, PageTitle, Screen, Text } from "~/ui";

const Li = ({ b, children }: { b: string; children: string }) => (
  <Text className="text-sm text-muted">
    • <Text className="text-sm font-bold">{b}</Text> {children}
  </Text>
);

export default function SaudeConectada() {
  const q = useData(["app-tokens"], async () => {
    const { data, error } = await supabase.from("app_tokens").select("*").order("created_at", { ascending: false });
    return { tokens: data ?? [], error: !!error };
  });
  const refresh = useRefresh(q);
  const [status, setStatus] = useState<HcStatus | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const disconnect = useCall("aluno/saude-conectada#disconnectHealthApps");
  useEffect(() => {
    void healthConnectStatus().then(setStatus);
    void hasHealthToken().then(setHasToken);
  }, []);
  if (!q.data || status === null) return <Loading />;
  const connected = q.data.tokens.length > 0 && hasToken;
  const last = q.data.tokens.filter((x) => x.last_sync_at).sort((a, b) => b.last_sync_at!.localeCompare(a.last_sync_at!))[0];

  async function sync() {
    setBusy("sync");
    setMsg(null);
    try {
      const r = await syncHealth();
      if (r.error) setMsg({ error: r.error });
      else setMsg({ ok: `Pronto! ${r.imported} atividade(s) recebida(s) e ${r.exported} treino(s) enviados ao Health Connect.` });
      setHasToken(await hasHealthToken());
      void queryClient.invalidateQueries();
    } catch {
      setMsg({ error: "Não foi possível sincronizar. Confira as permissões do Health Connect." });
    } finally {
      setBusy(null);
    }
  }
  async function connect() {
    setBusy("connect");
    setMsg(null);
    try {
      const r = await connectHealth();
      if (r.error) return setMsg({ error: r.error });
      setHasToken(true);
      await sync();
    } catch {
      setMsg({ error: "Não foi possível conectar ao Health Connect." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Samsung Health, Google Fit, Fitbit, relógios e GymRats, pelo Health Connect do Android.">❤️ Health Connect</PageTitle>
      {q.data.error ? <Alert className="mb-4">Falta aplicar a atualização do banco (SQL do Health Connect).</Alert> : null}
      {status === "indisponivel" ? <Alert className="mb-4">O Health Connect não está disponível neste celular (precisa de Android 9 ou mais novo).</Alert> : null}
      {status === "instalar" ? (
        <Alert kind="info" className="mb-4">
          Instale ou atualize o app Health Connect na Play Store para continuar.
        </Alert>
      ) : null}
      <Card className="mb-4 gap-2">
        <Text className="font-display text-lg font-bold">Como funciona</Text>
        <Li b="Entra no BoraTreinar:">corridas, caminhadas, pedal, natação e outros treinos registrados no Samsung Health, Google Fit, Fitbit ou no relógio (com tempo e distância). Contam na sua meta de cardio.</Li>
        <Li b="Sai do BoraTreinar:">seus treinos vão para o Health Connect. Assim o GymRats (e outros apps) já contam o treino sem você registrar de novo.</Li>
        <Li b="Samsung Health:">ligue em Configurações → Health Connect a sincronização para os dados chegarem.</Li>
      </Card>
      {connected ? (
        <Text className="mb-3 text-sm text-muted">
          {last?.last_sync_at
            ? `Última sincronização: ${formatDateTime(last.last_sync_at)} · ${last.last_imported ?? 0} atividade(s) recebida(s), ${last.last_exported ?? 0} treino(s) enviado(s).`
            : "Conectado. Toque em Sincronizar agora para trazer suas atividades."}
        </Text>
      ) : null}
      {msg?.error ? <Alert className="mb-3">{msg.error}</Alert> : msg?.ok ? <Alert kind="success" className="mb-3">{msg.ok}</Alert> : null}
      <View className="gap-3">
        {status === "instalar" ? (
          <Button onPress={() => void Linking.openURL("market://details?id=com.google.android.apps.healthdata")}>Instalar o Health Connect</Button>
        ) : null}
        {connected ? (
          <Button size="lg" icon={RefreshCw} loading={busy === "sync"} disabled={status !== "ok" || !!busy} onPress={sync}>
            Sincronizar agora
          </Button>
        ) : null}
        <Button variant={connected ? "ghost" : "primary"} size={connected ? "sm" : "lg"} icon={Smartphone} loading={busy === "connect"} disabled={status !== "ok" || !!busy} onPress={connect}>
          {connected ? "Conectar de novo" : "Conectar com o Health Connect"}
        </Button>
      </View>
      {q.data.tokens.length ? (
        <Button
          variant="ghost"
          className="mt-6 self-start"
          textClassName="text-pitanga-600"
          onPress={async () => {
            if (!(await confirmAsk("Desconectar o Health Connect? Os treinos já importados continuam no seu histórico.", { ok: "Desconectar", destructive: true }))) return;
            await disconnect.run();
            await forgetHealthToken();
            setHasToken(false);
          }}
        >
          Desconectar
        </Button>
      ) : null}
    </Screen>
  );
}
