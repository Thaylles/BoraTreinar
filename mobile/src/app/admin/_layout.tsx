import { Stack } from "expo-router";
import { useStackOptions } from "~/components/shell";

export default function AdminStack() {
  const opts = useStackOptions();
  return (
    <Stack screenOptions={opts}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
