import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { BellRing, Download, PencilLine, ShieldCheck, Trash2 } from "lucide-react-native";
import { form } from "~/lib/api";
import { downloadAndShare } from "~/lib/download";
import { useData, useRefresh } from "~/lib/data";
import { useProfile, useSession } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { useCall, useFormAction } from "~/lib/use-action";
import { Alert, Button, Card, FormMessage, Input, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";

function Title({ icon: Icon, children, danger }: { icon: typeof ShieldCheck; children: string; danger?: boolean }) {
  const t = useTheme();
  return (
    <View className="mb-1 flex-row items-center gap-2">
      <Icon color={danger ? t.pitanga600 : t.bandeira500} size={20} />
      <Text className={danger ? "font-display text-lg font-bold text-pitanga-600" : "font-display text-lg font-bold"}>{children}</Text>
    </View>
  );
}

/** Baixar meus dados (JSON) e compartilhar/salvar. */
export function ExportDataButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="ghost"
        className="self-start border-2 border-border bg-surface"
        icon={Download}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setErr(null);
          try {
            await downloadAndShare("/api/conta/exportar", "boratreinar-meus-dados.json", "application/json");
          } catch {
            setErr("Não deu para baixar agora. Confira a internet.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Baixar meus dados
      </Button>
      {err ? <Alert className="mt-2">{err}</Alert> : null}
    </>
  );
}

/** Excluir conta (digitar EXCLUIR). */
export function DeleteAccountForm({ action }: { action: string }) {
  const { signOut } = useSession();
  const [confirm, setConfirm] = useState("");
  const { state, pending, submit } = useFormAction(action, {
    onRedirect: () => {
      void signOut();
      return true;
    },
  });
  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold">
        Para confirmar, digite <Text className="text-sm font-bold">EXCLUIR</Text>
      </Text>
      <Input value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} placeholder="EXCLUIR" />
      <FormMessage state={state} />
      <Button variant="danger" loading={pending} onPress={() => submit({ confirm })}>
        Excluir minha conta e meus dados
      </Button>
    </View>
  );
}

export default function Privacidade() {
  const profile = useProfile();
  const q = useData(["privacidade", profile.id], async () => (await supabase.from("student_settings").select("personal_edits_plans, training_reminders").eq("student_id", profile.id).maybeSingle()).data);
  const refresh = useRefresh(q);
  const edits = useCall("aluno/privacidade#setPersonalEditsPlans");
  const rem = useCall("aluno/privacidade#setTrainingReminders");
  if (q.isLoading) return <Loading />;
  const allow = !!q.data?.personal_edits_plans;
  const reminders = q.data?.training_reminders ?? true;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Seus direitos pela LGPD (Lei Geral de Proteção de Dados).">Privacidade e meus dados</PageTitle>
      <Card className="mb-4">
        <Title icon={ShieldCheck}>Quem vê seus dados</Title>
        <Text className="text-sm text-muted">
          Só você e os Personais vinculados a você veem suas fichas e treinos. O peso só aparece para eles se você permitir na aba{" "}
          <Link href="/aluno/peso">
            <Text className="text-sm font-semibold underline">Peso</Text>
          </Link>
          . Leia os{" "}
          <Link href="/termos">
            <Text className="text-sm font-semibold underline">termos de uso e privacidade</Text>
          </Link>
          .
        </Text>
      </Card>
      <Card className="mb-4">
        <Title icon={PencilLine}>Fichas que você montou</Title>
        <Text className="mb-3 text-sm text-muted">
          {allow ? "Seu Personal pode editar e excluir as fichas que você montou. Você também continua editando." : "Só você edita as fichas que montou; seu Personal apenas vê. Libere para ele poder ajustar seus treinos."}
        </Text>
        <Button variant={allow ? "ghost" : "primary"} className={allow ? "self-start border-2 border-border bg-surface" : "self-start"} loading={edits.pending} onPress={() => edits.run(form({ allow: allow ? "0" : "1" }))}>
          {allow ? "Tirar a permissão do Personal" : "Permitir que meu Personal edite"}
        </Button>
      </Card>
      <Card className="mb-4">
        <Title icon={BellRing}>Lembrete do dia de treino</Title>
        <Text className="mb-3 text-sm text-muted">
          {reminders
            ? "Ligado: avisamos 1h antes da aula com seu Personal ou, sem aula, perto do horário em que você costuma treinar (“Hoje é dia de LOWER 💪”). Ative as notificações do celular na tela inicial."
            : "Desligado: você não recebe lembretes nos dias de treino."}
        </Text>
        <Button variant={reminders ? "ghost" : "primary"} className={reminders ? "self-start border-2 border-border bg-surface" : "self-start"} loading={rem.pending} onPress={() => rem.run(form({ on: reminders ? "0" : "1" }))}>
          {reminders ? "Desligar lembretes" : "Ligar lembretes"}
        </Button>
      </Card>
      <Card className="mb-4">
        <Title icon={Download}>Baixar meus dados</Title>
        <Text className="mb-3 text-sm text-muted">Um arquivo (JSON) com seu perfil, vínculos, fichas, treinos com todas as séries, pesagens, aulas e notificações.</Text>
        <ExportDataButton />
      </Card>
      <Card className="border-pitanga-500/40">
        <Title icon={Trash2} danger>
          Excluir minha conta
        </Title>
        <Text className="mb-3 text-sm text-muted">
          Apaga sua conta e <Text className="text-sm font-bold">todos</Text> os seus dados: treinos, pesagens, fichas e aulas. Seus Personais são avisados e deixam de ver você.{" "}
          <Text className="text-sm font-bold">Não dá para desfazer.</Text> Se quiser guardar seu histórico, baixe seus dados antes.
        </Text>
        <DeleteAccountForm action="aluno/privacidade#deleteMyAccount" />
      </Card>
    </Screen>
  );
}
