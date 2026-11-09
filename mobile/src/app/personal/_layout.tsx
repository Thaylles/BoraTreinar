import { Stack } from "expo-router";
import { useStackOptions } from "~/components/shell";

export default function PersonalStack() {
  const opts = useStackOptions();
  return (
    <Stack screenOptions={opts}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Registro do treino de um aluno: tela cheia como o treino do aluno. */}
      <Stack.Screen name="alunos/[id]/registrar/[planId]" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
