import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Link, router, Tabs, usePathname, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, CalendarDays, Dumbbell, Film, History, House, ImagePlus, Inbox, LogOut, Scale, User, Users, Wallet, type LucideIcon } from "lucide-react-native";
import { avatarUrl } from "@/lib/avatar";
import { firstName } from "@/lib/format";
import { useSession } from "~/lib/session";
import { Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Avatar } from "~/ui/extras";
import { Logo } from "~/ui/logo";

export const ICONS: Record<string, LucideIcon> = {
  house: House,
  chart: BarChart3,
  history: History,
  scale: Scale,
  calendar: CalendarDays,
  user: User,
  users: Users,
  dumbbell: Dumbbell,
  wallet: Wallet,
  inbox: Inbox,
  film: Film,
  image: ImagePlus,
};

type Root = "/aluno" | "/personal" | "/admin";
const ADMIN_MODES: { href: Root; label: string }[] = [
  { href: "/admin", label: "Admin" },
  { href: "/personal", label: "Personal" },
  { href: "/aluno", label: "Aluno" },
];
const PERSONAL_MODES: { href: Root; label: string }[] = [
  { href: "/personal", label: "👥 Meus alunos" },
  { href: "/aluno", label: "🏋️ Meu treino" },
];

/** Topo do app: marca, perfil, sair e (Personal/admin) a troca de área — igual ao site. */
export function AppHeader({ root, roleLabel, profileHref, brand }: { root: Root; roleLabel: string; profileHref?: Href; brand?: { logoPath: string; name: string } | null }) {
  const { profile, signOut } = useSession();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  if (!profile) return null;
  const modes = profile.role === "admin" ? ADMIN_MODES : profile.role === "personal" ? PERSONAL_MODES : null;
  return (
    <View style={{ paddingTop: insets.top }} className="border-b border-border bg-background">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Link href={root} asChild>
          <Pressable className="min-w-0 flex-shrink">
            {brand ? (
              <View className="flex-row items-center gap-2">
                <View className="h-9 justify-center rounded-lg bg-white px-2 py-1">
                  <Image source={avatarUrl(brand.logoPath)!} style={{ height: 28, width: 120 }} contentFit="contain" />
                </View>
                <Text className="text-[10px] font-semibold uppercase leading-tight text-muted">{"via\nBoraTreinar"}</Text>
              </View>
            ) : (
              <Logo size={28} />
            )}
          </Pressable>
        </Link>
        <View className="flex-row items-center gap-2">
          <Link href={profileHref ?? (`${root}/perfil` as Href)} asChild>
            <Pressable className="flex-row items-center gap-2 rounded-full py-0.5 pl-3 pr-0.5" accessibilityLabel="Meu perfil">
              <View className="items-end">
                <Text className="text-sm font-semibold">{firstName(profile.full_name)}</Text>
                <Text className="text-xs text-muted">{roleLabel}</Text>
              </View>
              <Avatar path={profile.avatar_path} name={profile.full_name} size={36} />
            </Pressable>
          </Link>
          <Pressable onPress={() => void signOut()} className="rounded-full p-2" accessibilityLabel="Sair">
            <LogOut color={t.muted} size={20} />
          </Pressable>
        </View>
      </View>
      {modes ? (
        <View className="flex-row items-center gap-2 bg-anil-700 px-4 py-1.5">
          <Text className="text-xs font-semibold text-white/75">{profile.role === "admin" ? "Modo:" : "Área:"}</Text>
          {modes.map((m) => (
            <Pressable key={m.href} onPress={() => router.replace(m.href)} className={cn("rounded-full px-3 py-1", root === m.href && "bg-ipe-500")}>
              <Text className={cn("text-xs", root === m.href ? "font-bold text-anil-900" : "font-semibold text-white")}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export type TabItem = { name: string; label: string; icon: keyof typeof ICONS; hidden?: boolean; badge?: number };

/** Barra inferior (as mesmas abas do site para cada área). */
export function AreaTabs({ items, header, extra }: { items: TabItem[]; header: () => ReactNode; extra?: string[] }) {
  const t = useTheme();
  // Android com tela inteira (edge-to-edge): o menu sobe acima dos botões/gesto do sistema.
  const bottom = useSafeAreaInsets().bottom;
  return (
    <Tabs
      screenOptions={{
        header,
        tabBarActiveTintColor: t.bandeira500,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, height: 64 + bottom, paddingBottom: 8 + bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
        sceneStyle: { backgroundColor: t.background },
      }}
    >
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        return (
          <Tabs.Screen
            key={it.name}
            name={it.name}
            options={{
              title: it.label,
              href: it.hidden ? null : undefined,
              tabBarIcon: ({ color, size }) => <Icon color={color} size={size - 2} />,
              tabBarBadge: it.badge ? it.badge : undefined,
            }}
          />
        );
      })}
      {(extra ?? []).map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

/** Pilha de telas internas de uma área (com cabeçalho e botão voltar nativos). */
export function useStackOptions() {
  const t = useTheme();
  return {
    headerShown: true,
    headerTitle: "",
    headerShadowVisible: false,
    headerStyle: { backgroundColor: t.background },
    headerTintColor: t.foreground,
    contentStyle: { backgroundColor: t.background },
    animation: "slide_from_right" as const,
  };
}

export function usePathStartsWith(prefix: string) {
  return usePathname().startsWith(prefix);
}
