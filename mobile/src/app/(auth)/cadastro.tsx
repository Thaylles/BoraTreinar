import { useState } from "react";
import { View } from "react-native";
import { Link, useLocalSearchParams, router } from "expo-router";
import { AuthCard } from "~/components/auth-card";
import { TermsCheckbox } from "~/components/terms-checkbox";
import { useFormAction } from "~/lib/use-action";
import { Button, FormMessage, Text } from "~/ui";
import { DateField, Segmented, TextField } from "~/ui/forms";

export default function CadastroScreen() {
  const params = useLocalSearchParams<{ tipo?: string }>();
  const [tipo, setTipo] = useState<"aluno" | "personal">(params.tipo === "aluno" ? "aluno" : "personal");
  const aluno = tipo === "aluno";
  const [f, setF] = useState({ full_name: "", email: "", phone: "", birth_date: "", password: "" });
  const [terms, setTerms] = useState(false);
  const { state, pending, submit } = useFormAction(aluno ? "auth#signUpStudentOpen" : "auth#signUpPersonal");
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <AuthCard>
      <Segmented
        value={tipo}
        onChange={setTipo}
        options={[
          { value: "aluno", label: "Sou aluno" },
          { value: "personal", label: "Sou Personal" },
        ]}
      />
      <View>
        <Text className="font-display text-3xl font-extrabold">{aluno ? "Sou aluno" : "Sou Personal"}</Text>
        <Text className="text-muted">
          {aluno
            ? "Crie sua conta para registrar seus treinos. Depois, se quiser, encontre um Personal para te acompanhar."
            : "Crie sua conta e comece a convidar seus alunos."}
        </Text>
      </View>
      {state?.ok ? (
        <>
          <FormMessage state={state} />
          <Button variant="secondary" onPress={() => router.replace("/entrar")}>
            Ir para o login
          </Button>
        </>
      ) : (
        <>
          <TextField label="Nome completo" value={f.full_name} onChangeText={set("full_name")} autoComplete="name" />
          <TextField label="E-mail" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <TextField
            label={aluno ? "WhatsApp" : "WhatsApp (opcional)"}
            value={f.phone}
            onChangeText={set("phone")}
            keyboardType="phone-pad"
            placeholder="(11) 99999-0000"
            hint={aluno ? "Um Personal pode te adicionar pelo seu WhatsApp ou e-mail." : undefined}
          />
          <DateField
            label={aluno ? "Data de nascimento (opcional)" : "Data de nascimento"}
            value={f.birth_date}
            onChange={set("birth_date")}
            hint={aluno ? undefined : "Sua idade aparece para alunos que procuram um Personal."}
          />
          <TextField label="Senha" value={f.password} onChangeText={set("password")} secureTextEntry autoComplete="new-password" hint="Mínimo de 8 caracteres." />
          <TermsCheckbox checked={terms} onChange={setTerms} />
          <FormMessage state={state} />
          <Button size="lg" loading={pending} onPress={() => submit({ ...f, terms })}>
            {pending ? "Criando conta…" : aluno ? "Criar conta e bora!" : "Criar conta"}
          </Button>
        </>
      )}
      <View className="flex-row justify-center gap-1">
        <Text className="text-sm text-muted">Já tem conta?</Text>
        <Link href="/entrar">
          <Text className="text-sm font-semibold text-bandeira-600">Entrar</Text>
        </Link>
      </View>
    </AuthCard>
  );
}
