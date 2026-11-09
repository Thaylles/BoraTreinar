import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { friendlyError } from "@/lib/errors";
import { AuthCard } from "~/components/auth-card";
import { supabase } from "~/lib/supabase";
import { Alert, Button, Text } from "~/ui";
import { TextField } from "~/ui/forms";

export default function EntrarScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (error) setError(friendlyError(error.message));
    // Com a sessão criada, o layout raiz abre a área de cada papel.
  }

  return (
    <AuthCard>
      <View>
        <Text className="font-display text-3xl font-extrabold">Bora treinar!</Text>
        <Text className="text-muted">Entre com seu e-mail e senha.</Text>
      </View>
      <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <TextField label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={signIn} />
      <Link href="/recuperar-senha" className="self-end">
        <Text className="text-sm font-semibold text-anil-700 dark:text-ipe-500">Esqueci minha senha</Text>
      </Link>
      {error ? <Alert>{error}</Alert> : null}
      <Button size="lg" onPress={signIn} loading={pending} disabled={!email || !password}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
      <View className="flex-row flex-wrap justify-center gap-1">
        <Text className="text-sm text-muted">Não tem conta?</Text>
        <Link href={{ pathname: "/cadastro", params: { tipo: "aluno" } }}>
          <Text className="text-sm font-semibold text-bandeira-600">Sou aluno</Text>
        </Link>
        <Text className="text-sm text-muted">·</Text>
        <Link href="/cadastro">
          <Text className="text-sm font-semibold text-bandeira-600">Sou Personal</Text>
        </Link>
      </View>
    </AuthCard>
  );
}
