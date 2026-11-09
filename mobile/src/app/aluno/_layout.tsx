import { Stack } from "expo-router";
import { useStackOptions } from "~/components/shell";

export default function AlunoStack() {
  const opts = useStackOptions();
  return (
    <Stack screenOptions={opts}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Treino em andamento: tela cheia, sem voltar por gesto sem querer. */}
      <Stack.Screen name="treinar/[planId]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="treinar/modelo/[templateId]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="livre/treinar" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
