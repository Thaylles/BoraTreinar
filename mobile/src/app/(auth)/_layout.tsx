import { Stack } from "expo-router";
import { useTheme } from "~/ui";

export default function AuthLayout() {
  const t = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background } }} />;
}
