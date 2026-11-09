import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2";
import { QueryProvider } from "~/lib/query";
import { SessionProvider, useSession } from "~/lib/session";
import { useTheme } from "~/ui";

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { ready, session, profile } = useSession();
  const t = useTheme();
  const [fonts] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
  });
  const loaded = ready && fonts;
  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  const signedIn = !!session && !!profile;
  const role = profile?.role;
  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: "slide_from_right" }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" />
          {/* Personal também treina ("Meu treino") e o admin entra em todas as áreas, como no site. */}
          <Stack.Protected guard={role === "aluno" || role === "personal" || role === "admin"}>
            <Stack.Screen name="aluno" />
          </Stack.Protected>
          <Stack.Protected guard={role === "personal" || role === "admin"}>
            <Stack.Screen name="personal" />
          </Stack.Protected>
          <Stack.Protected guard={role === "admin"}>
            <Stack.Screen name="admin" />
          </Stack.Protected>
        </Stack.Protected>
        <Stack.Screen name="termos" options={{ presentation: "modal" }} />
        <Stack.Screen name="como-usar" />
      </Stack>
    </>
  );
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <SessionProvider>
          <RootStack />
        </SessionProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
