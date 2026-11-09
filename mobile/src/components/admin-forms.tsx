import { useState } from "react";
import { View } from "react-native";
import { Mail } from "lucide-react-native";
import { useFormAction } from "~/lib/use-action";
import { Button, Card, FormMessage, Input, Text, useTheme } from "~/ui";
import { DateField, TextField } from "~/ui/forms";

type P = { id: string; full_name: string; email: string; phone: string | null; birth_date: string | null };

/** Admin edita os dados de cadastro de um Personal ou aluno. */
export function AdminProfileForm({ profile }: { profile: P }) {
  const [name, setName] = useState(profile.full_name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [birth, setBirth] = useState(profile.birth_date ?? "");
  const { state, pending, submit } = useFormAction("admin#adminUpdateProfile");
  return (
    <View className="gap-3">
      <TextField label="Nome" value={name} onChangeText={setName} />
      <TextField label="E-mail (login)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextField label="WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>
        <View className="flex-1">
          <DateField label="Nascimento" value={birth} onChange={setBirth} />
        </View>
      </View>
      <FormMessage state={state} />
      <Button className="self-start" loading={pending} onPress={() => submit({ id: profile.id, full_name: name, email, phone, birth_date: birth })}>
        Salvar alterações
      </Button>
    </View>
  );
}

export function TestEmailCard() {
  const t = useTheme();
  const { state, pending, submit } = useFormAction("admin#adminSendTestEmail");
  return (
    <Card className="mb-8 gap-3 p-4">
      <View className="flex-row items-center gap-2">
        <Mail color={t.bandeira500} size={20} />
        <Text className="font-display text-lg font-bold">E-mails do app</Text>
      </View>
      <Text className="text-sm text-muted">Manda um e-mail de teste para você agora. Serve para conferir se o lembrete das 7h e o relatório de domingo vão chegar.</Text>
      <FormMessage state={state} />
      <Button variant="secondary" className="self-start" loading={pending} onPress={() => submit({})}>
        Enviar e-mail de teste
      </Button>
    </Card>
  );
}

export function DeletePersonalForm({ id }: { id: string }) {
  const [confirm, setConfirm] = useState("");
  const { state, pending, submit } = useFormAction("admin#adminDeletePersonal");
  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold">
        Para confirmar, digite <Text className="text-sm font-bold">EXCLUIR</Text>
      </Text>
      <Input value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder="EXCLUIR" />
      <FormMessage state={state} />
      <Button variant="danger" loading={pending} onPress={() => submit({ id, confirm })}>
        Excluir Personal
      </Button>
    </View>
  );
}
