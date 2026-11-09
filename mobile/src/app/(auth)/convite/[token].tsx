import { useState } from "react";
import { View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { firstName } from "@/lib/format";
import { AuthCard } from "~/components/auth-card";
import { TermsCheckbox } from "~/components/terms-checkbox";
import { supabase } from "~/lib/supabase";
import { useFormAction } from "~/lib/use-action";
import { Button, FormMessage, Loading, Text } from "~/ui";
import { DateField, TextField } from "~/ui/forms";

const MOTIVOS: Record<string, string> = {
  usado: "Esse convite já foi usado.",
  expirado: "Esse convite expirou.",
  revogado: "Esse convite foi cancelado pelo Personal.",
};

/** Aluno chegou pelo link de convite do Personal (deep link boratreinar://convite/<token>). */
export default function ConviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data: invite, isLoading } = useQuery({
    queryKey: ["convite", token],
    queryFn: async () => (await supabase.rpc("get_invite_public", { p_token: token })).data?.[0] ?? null,
  });
  const [f, setF] = useState({ full_name: "", email: "", phone: "", birth_date: "", password: "" });
  const [terms, setTerms] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const { state, pending, submit } = useFormAction("auth#signUpStudent", {
    // Conta criada: entra com o mesmo e-mail e senha.
    onRedirect: () => {
      void supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
      return true;
    },
  });

  if (isLoading) return <Loading />;
  if (!invite || invite.status !== "pendente") {
    return (
      <AuthCard>
        <Text className="text-center text-5xl">🫤</Text>
        <Text className="text-center font-display text-2xl font-extrabold">{invite ? MOTIVOS[invite.status] : "Convite não encontrado."}</Text>
        <Text className="text-center text-muted">Peça um novo link de convite ao seu Personal.</Text>
        <Button variant="secondary" onPress={() => router.replace("/entrar")}>
          Já tenho conta
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard>
      <View>
        <Text className="font-display text-3xl font-extrabold">{firstName(invite.personal_name)} te chamou pra treinar! 💪</Text>
        <Text className="text-muted">Crie sua conta para ver suas fichas e registrar seus treinos.</Text>
      </View>
      <TextField label="Nome completo" value={f.full_name} onChangeText={set("full_name")} autoComplete="name" />
      <TextField label="E-mail" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="WhatsApp" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="(11) 99999-0000" />
      <DateField label="Data de nascimento (opcional)" value={f.birth_date} onChange={set("birth_date")} />
      <TextField label="Senha" value={f.password} onChangeText={set("password")} secureTextEntry hint="Mínimo de 8 caracteres." />
      <TermsCheckbox checked={terms} onChange={setTerms} />
      <FormMessage state={state} />
      <Button size="lg" loading={pending} onPress={() => submit({ ...f, token, terms })}>
        {pending ? "Criando conta…" : "Criar conta e bora!"}
      </Button>
      <Link href="/entrar" className="self-center">
        <Text className="text-sm font-semibold text-bandeira-600">Já tenho conta</Text>
      </Link>
    </AuthCard>
  );
}
