import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, PageTitle } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { requireRole } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { syncIntentUrl } from "@/lib/health-connect/shared";
import { disconnectHealthApps } from "./actions";
import { ConnectButtons } from "./connect-buttons";

export const metadata: Metadata = { title: "Health Connect" };

export default async function SaudeConectadaPage({ searchParams }: { searchParams: Promise<{ "sem-app"?: string }> }) {
  await requireRole("aluno");
  const noApp = (await searchParams)["sem-app"] === "1";
  const supabase = await createClient();
  const { data: tokens, error } = await supabase.from("app_tokens").select("*").order("created_at", { ascending: false });
  const connected = !!tokens?.length;
  const last = tokens?.filter((t) => t.last_sync_at).sort((a, b) => b.last_sync_at!.localeCompare(a.last_sync_at!))[0];

  return (
    <>
      <Link href="/aluno/perfil" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Perfil
      </Link>
      <PageTitle sub="Samsung Health, Google Fit, Fitbit, relógios e GymRats, pelo Health Connect do Android.">❤️ Health Connect</PageTitle>

      {noApp && (
        <Alert className="mb-4">
          Para sincronizar, abra o BoraTreinar pelo <strong>app Android</strong> (o .apk). No navegador ou no iPhone a sincronização não
          funciona.
        </Alert>
      )}
      {error && <Alert className="mb-4">Falta aplicar a atualização do banco (SQL do Health Connect).</Alert>}

      <Card className="mb-4 space-y-2 text-sm">
        <p className="font-display text-lg font-bold">Como funciona</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            <strong className="text-foreground">Entra no BoraTreinar:</strong> corridas, caminhadas, pedal, natação e outros treinos
            registrados no Samsung Health, Google Fit, Fitbit ou no relógio (com tempo e distância). Contam na sua meta de cardio.
          </li>
          <li>
            <strong className="text-foreground">Sai do BoraTreinar:</strong> seus treinos vão para o Health Connect. Assim o{" "}
            <strong className="text-foreground">GymRats</strong> (e outros apps) já contam o treino sem você registrar de novo.
          </li>
          <li>Só no app Android do BoraTreinar, com o Health Connect instalado (já vem no Android 14 ou mais novo).</li>
          <li>
            No Samsung Health, ligue em <em>Configurações → Health Connect</em> a sincronização para os dados chegarem.
          </li>
        </ul>
      </Card>

      {connected && (
        <p className="mb-3 text-sm text-muted">
          {last?.last_sync_at
            ? `Última sincronização: ${formatDateTime(last.last_sync_at)} · ${last.last_imported ?? 0} atividade(s) recebida(s), ${last.last_exported ?? 0} treino(s) enviado(s).`
            : "Conectado. Toque em Sincronizar agora para trazer suas atividades."}
        </p>
      )}
      <ConnectButtons connected={connected} syncUrl={syncIntentUrl(appUrl)} />

      {connected && (
        <form action={disconnectHealthApps} className="mt-6">
          <ConfirmSubmit
            message="Desconectar o app Android? Os treinos já importados continuam no seu histórico."
            className="text-sm font-semibold text-pitanga-600 hover:underline"
          >
            Desconectar
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}
