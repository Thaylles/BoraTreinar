import "../global.css";
import { useEffect } from "react";
import { router, Stack, useSegments } from "expo-router";
import { homeFor } from "~/lib/session";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2";
import { QueryProvider } from "~/lib/query";
import { SessionProvider, useSession } from "~/lib/session";
import { useTheme } from "~/ui";
import { useDeviceNotifications } from "~/components/device-notifications";

void SplashScreen.preventAutoHideAsync();

/** Entrou: vai para a área do papel. Saiu (ou sessão expirou): volta para o login. */
function useAuthRedirect(loaded: boolean, signedIn: boolean, role: string | undefined) {
  const segments = useSegments();
  const top = segments[0] as string | undefined;
  useEffect(() => {
    if (!loaded) return;
    const inAuth = top === "(auth)";
    const open = top === "termos" || top === "como-usar";
    if (signedIn && (inAuth || !top)) router.replace(homeFor(role as never) as never);
    else if (!signedIn && !inAuth && !open) router.replace("/entrar");
  }, [loaded, signedIn, role, top]);
}

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
  useDeviceNotifications(!!session && !!profile);
  useAuthRedirect(ready && fonts, !!session && !!profile, profile?.role);
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
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        {/* Personal também treina ("Meu treino") e o admin entra em todas as áreas, como no site. */}
        <Stack.Protected guard={signedIn && (role === "aluno" || role === "personal" || role === "admin")}>
          <Stack.Screen name="aluno" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && (role === "personal" || role === "admin")}>
          <Stack.Screen name="personal" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && role === "admin"}>
          <Stack.Screen name="admin" />
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
