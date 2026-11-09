import { useState, type ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, type Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { avatarUrl } from "@/lib/avatar";
import { cx as cn } from "./cn";
import { Text } from "./text";
import { palette, useTheme } from "./theme";

const GRADIENTS = {
  bandeira: [palette.bandeira500, palette.bandeira700],
  anil: [palette.anil700, palette.anil900],
} as const;

/** Cartão com degradê (bg-gradient-to-br do site). */
export function Gradient({ tone = "bandeira", className, style, children }: { tone?: keyof typeof GRADIENTS; className?: string; style?: ViewStyle; children: ReactNode }) {
  return (
    <View className={cn("overflow-hidden rounded-3xl", className)} style={style}>
      <LinearGradient colors={GRADIENTS[tone]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", inset: 0 }} />
      {children}
    </View>
  );
}

export function Avatar({ path, name, size = 44 }: { path?: string | null; name: string; size?: number }) {
  const src = avatarUrl(path);
  if (src) return <Image source={src} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center rounded-full bg-bandeira-50 dark:bg-bandeira-500/15">
      <Text className="font-display font-bold text-bandeira-700 dark:text-bandeira-100" style={{ fontSize: Math.round(size * 0.4) }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Atalho em cartão: emoji, título, texto e seta (padrão "Link" das telas iniciais do site). */
export function ShortcutCard({
  href,
  emoji,
  title,
  sub,
  className,
  titleClassName,
  subClassName,
}: {
  href: Href;
  emoji: string;
  title: ReactNode;
  sub?: ReactNode;
  className?: string;
  titleClassName?: string;
  subClassName?: string;
}) {
  const t = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable className={cn("mb-4 flex-row items-center gap-3 rounded-3xl border border-border bg-surface p-4 active:opacity-80", className)}>
        <Text className="text-3xl">{emoji}</Text>
        <View className="min-w-0 flex-1">
          <Text className={cn("font-display font-bold", titleClassName)}>{title}</Text>
          {sub ? <Text className={cn("text-sm text-muted", subClassName)}>{sub}</Text> : null}
        </View>
        <ChevronRight color={t.muted} size={20} />
      </Pressable>
    </Link>
  );
}

export function ProgressBar({ pct, className, barClassName }: { pct: number; className?: string; barClassName?: string }) {
  return (
    <View className={cn("h-3 overflow-hidden rounded-full bg-border/60", className)} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View className={cn("h-full rounded-full bg-bandeira-500", barClassName)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </View>
  );
}

/** <details> do site: título clicável que abre o conteúdo. */
export function Disclosure({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View className={className}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text className="text-xs font-semibold text-muted">
          {open ? "▾" : "▸"} {label}
        </Text>
      </Pressable>
      {open ? <View className="mt-2">{children}</View> : null}
    </View>
  );
}
