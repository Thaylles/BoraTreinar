import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, View, type ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { whatsappLink } from "@/lib/whatsapp";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, type Href } from "expo-router";
import { ChevronRight, X as XIcon } from "lucide-react-native";
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

/** Janela que sobe de baixo (os <dialog> do site). */
export function Sheet({ visible, onClose, title, sub, children }: { visible: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <Pressable className="flex-1 bg-black/40" onPress={onClose} />
        <View className="max-h-[85%] rounded-t-3xl bg-background">
          <View className="flex-row items-start justify-between gap-2 border-b border-border px-5 py-4">
            <View className="flex-1">
              <Text className="font-display text-xl font-bold">{title}</Text>
              {sub ? <Text className="text-sm text-muted">{sub}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Fechar" className="rounded-full p-1">
              <XIcon color={t.foreground} size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-4 p-5 pb-10" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Botão do WhatsApp (abre a conversa com a mensagem pronta). */
export function WhatsAppButton({ phone, compact = false, text, label = "Chamar no WhatsApp", className }: { phone: string | null | undefined; compact?: boolean; text?: string; label?: string; className?: string }) {
  const href = whatsappLink(phone, text);
  if (!href) return null;
  return (
    <Pressable
      onPress={() => void Linking.openURL(href)}
      accessibilityLabel={label}
      className={cn("flex-row items-center justify-center gap-2 rounded-2xl bg-[#25D366]", compact ? "size-11" : "px-4 py-2.5", className)}
    >
      <WhatsIcon size={compact ? 24 : 20} />
      {!compact ? <Text className="font-display font-bold text-[#0b3d1f]">{label}</Text> : null}
    </Pressable>
  );
}

function WhatsIcon({ size }: { size: number }) {
  return (
    <SvgXml
      width={size}
      height={size}
      xml={`<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0b3d1f" d="M12.04 2C6.57 2 2.13 6.43 2.13 11.9c0 1.75.46 3.46 1.33 4.97L2 22l5.27-1.38a9.9 9.9 0 0 0 4.77 1.22h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.83 9.83 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.13-.55.12-.17.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.23-.73-.66-1.23-1.47-1.38-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.31c-.22.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.2 3.7.58.25 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29Z"/></svg>`}
    />
  );
}
