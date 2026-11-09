import { Stack } from "expo-router";
import { useStackOptions } from "~/components/shell";

export default function Layout() {
  const opts = useStackOptions();
  return <Stack screenOptions={opts} />;
}
