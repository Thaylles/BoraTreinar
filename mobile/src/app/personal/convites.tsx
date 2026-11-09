import { useState } from "react";
import { Pressable, Share, View } from "react-native";
import { Share2, Ticket } from "lucide-react-native";
import { formatDate, relativeDays } from "@/lib/format";
import type { Tables } from "@/lib/database.types";
import { form } from "~/lib/api";
import { API_URL } from "~/lib/config";
import { useData, useRefresh } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { useCall, useFormAction } from "~/lib/use-action";
import { Badge, Button, Card, EmptyState, FormMessage, Loading, PageTitle, Screen, Text } from "~/ui";
import { Select, TextField } from "~/ui/forms";
import { CopyButton } from "~/components/pix-pay";

type Status = "pendente" | "usado" | "expirado" | "revogado";
const statusOf = (i: Tables<"invites">, now: Date): Status => (i.revoked_at ? "revogado" : i.used_at ? "usado" : new Date(i.expires_at) <= now ? "expirado" : "pendente");
const BADGE: Record<Status, { tone: "green" | "yellow" | "red" | "neutral"; text: string }> = {
  pendente: { tone: "yellow", text: "Pendente" },
  usado: { tone: "green", text: "Usado" },
  expirado: { tone: "neutral", text: "Expirado" },
  revogado: { tone: "red", text: "Revogado" },
};
const shareInvite = (url: string) => void Share.share({ message: `Bora treinar? Crie sua conta no BoraTreinar pelo meu convite: ${url}` });

function InviteForm() {
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("7");
  const { state, pending, submit } = useFormAction("personal#createInvite");
  const token = (state as { token?: string } | null)?.token;
  const link = token ? `${API_URL}/convite/${token}` : null;
  return (
    <View className="gap-4">
      <TextField label="Para quem é? (opcional)" value={label} onChangeText={setLabel} maxLength={80} placeholder="Ex.: Maria, turma da manhã" hint="Só você vê. Ajuda a lembrar quem já usou o convite." />
      <Select
        label="Validade"
        value={days}
        onChange={setDays}
        options={[
          { value: "1", label: "1 dia" },
          { value: "3", label: "3 dias" },
          { value: "7", label: "7 dias (padrão)" },
          { value: "15", label: "15 dias" },
          { value: "30", label: "30 dias" },
        ]}
      />
      <Button loading={pending} onPress={() => submit({ label, days })}>
        Gerar link de convite
      </Button>
      <FormMessage state={state} />
      {link ? (
        <View className="gap-2 rounded-2xl bg-background p-3">
          <Text className="text-sm" selectable>
            {link}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <CopyButton text={link} />
            <Button icon={Share2} variant="secondary" onPress={() => shareInvite(link)}>
              Compartilhar
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function Convites() {
  const q = useData(["invites"], async () => (await supabase.from("invites").select("*, used_by_profile:profiles!invites_used_by_fkey(full_name)").order("created_at", { ascending: false }).limit(100)).data ?? []);
  const refresh = useRefresh(q);
  const revoke = useCall("personal#revokeInvite");
  const now = new Date();
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Gere um link e mande para o aluno. Ao se cadastrar, ele já fica vinculado a você.">Convites</PageTitle>
      <Card className="mb-8">
        <InviteForm />
      </Card>
      <Text className="mb-3 font-display text-xl font-bold">Seus convites</Text>
      {!q.data ? (
        <Loading />
      ) : !q.data.length ? (
        <EmptyState icon={Ticket} title="Nenhum convite ainda">
          Gere o primeiro link acima.
        </EmptyState>
      ) : (
        <View className="gap-3">
          {q.data.map((inv) => {
            const status = statusOf(inv, now);
            const link = `${API_URL}/convite/${inv.token}`;
            return (
              <Card key={inv.id} className="p-4">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-semibold">{inv.label || "Convite sem nome"}</Text>
                    <Text className="text-xs text-muted">
                      Criado em {formatDate(inv.created_at)} · {status === "pendente" ? `expira ${relativeDays(inv.expires_at, now)}` : status === "usado" ? `usado por ${inv.used_by_profile?.full_name ?? "aluno"}` : `válido até ${formatDate(inv.expires_at)}`}
                    </Text>
                  </View>
                  <Badge tone={BADGE[status].tone}>{BADGE[status].text}</Badge>
                </View>
                {status === "pendente" ? (
                  <View className="mt-3 flex-row flex-wrap items-center gap-2">
                    <CopyButton text={link} />
                    <Pressable onPress={() => shareInvite(link)} className="rounded-xl px-3 py-1.5">
                      <Text className="text-sm font-semibold text-anil-700 dark:text-ipe-500">Compartilhar</Text>
                    </Pressable>
                    <Pressable onPress={() => revoke.run(form({ id: inv.id }))} className="rounded-xl px-3 py-1.5">
                      <Text className="text-sm font-semibold text-pitanga-600">Revogar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
