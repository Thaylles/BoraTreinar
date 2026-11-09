import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { AuthCard } from "~/components/auth-card";
import { useFormAction } from "~/lib/use-action";
import { Button, FormMessage, Text } from "~/ui";
import { TextField } from "~/ui/forms";

export default function RecuperarSenhaScreen() {
  const [email, setEmail] = useState("");
  const { state, pending, submit } = useFormAction("auth#requestPasswordReset");
  return (
    <AuthCard>
      <View>
        <Text className="font-display text-3xl font-extrabold">Esqueceu a senha?</Text>
        <Text className="text-muted">Relaxa, acontece. Mandamos um link para você criar outra.</Text>
      </View>
      <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <FormMessage state={state} />
      <Button size="lg" loading={pending} onPress={() => submit({ email })}>
        {pending ? "Enviando…" : "Enviar link"}
      </Button>
      <Link href="/entrar" className="self-center">
        <Text className="text-sm font-semibold text-bandeira-600">Voltar para o login</Text>
      </Link>
    </AuthCard>
  );
}
