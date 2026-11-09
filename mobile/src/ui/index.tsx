import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { Link, type Href } from "expo-router";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { CircleAlert, CircleCheck, type LucideIcon } from "lucide-react-native";
import { cx as cn } from "./cn";
import { Text } from "./text";
import { useTheme } from "./theme";

export { Text } from "./text";
export { useTheme, palette } from "./theme";

/** Tela com fundo areia e rolagem; `refresh` liga o "puxar para atualizar". */
export function Screen({
  children,
  scroll = true,
  className,
  edges = ["top"],
  ...props
}: ScrollViewProps & { children: ReactNode; scroll?: boolean; className?: string; edges?: Edge[] }) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-background">
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={cn("px-4 pb-24 pt-4", className)}
          keyboardShouldPersistTaps="handled"
          {...props}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn("flex-1 px-4 pt-4", className)}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="font-display text-3xl font-extrabold leading-tight">{children}</Text>
      {sub ? <Text className="mt-1 text-muted">{sub}</Text> : null}
    </View>
  );
}

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("rounded-3xl border border-border bg-surface p-5", className)} {...props} />;
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ipe";
type Size = "sm" | "md" | "lg";
const variants: Record<Variant, { box: string; text: string }> = {
  primary: { box: "bg-bandeira-500 active:bg-bandeira-600", text: "text-white" },
  secondary: { box: "border-2 border-anil-700 dark:border-ipe-500 active:bg-anil-700/10", text: "text-anil-700 dark:text-ipe-500" },
  ghost: { box: "active:bg-ipe-100 dark:active:bg-surface", text: "text-foreground" },
  danger: { box: "bg-pitanga-500 active:bg-pitanga-600", text: "text-white" },
  ipe: { box: "bg-ipe-500 active:bg-ipe-400", text: "text-anil-900" },
};
const sizes: Record<Size, { box: string; text: string }> = {
  sm: { box: "px-3 py-1.5 rounded-xl", text: "text-sm" },
  md: { box: "px-4 py-2.5 rounded-2xl", text: "text-base" },
  lg: { box: "px-6 py-4 rounded-2xl", text: "text-lg" },
};

export type ButtonProps = PressableProps & {
  variant?: Variant;
  size?: Size;
  className?: string;
  textClassName?: string;
  loading?: boolean;
  icon?: LucideIcon;
  children?: ReactNode;
};

export function Button({ variant = "primary", size = "md", className, textClassName, loading, icon: Icon, children, disabled, ...props }: ButtonProps) {
  const v = variants[variant];
  const s = sizes[size];
  const t = useTheme();
  const color = variant === "primary" || variant === "danger" ? "#fff" : variant === "ipe" ? t.anil900 : variant === "secondary" ? (t.dark ? t.ipe500 : t.anil700) : t.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={cn("flex-row items-center justify-center gap-2", v.box, s.box, (disabled || loading) && "opacity-60", className)}
      {...props}
    >
      {loading ? <ActivityIndicator color={color} size="small" /> : Icon ? <Icon color={color} size={size === "lg" ? 22 : 18} /> : null}
      {typeof children === "string" ? <Text className={cn("font-display font-bold", v.text, s.text, textClassName)}>{children}</Text> : children}
    </Pressable>
  );
}

export function LinkButton({ href, ...props }: ButtonProps & { href: Href }) {
  return (
    <Link href={href} asChild>
      <Button {...props} />
    </Link>
  );
}

export const inputClass = "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-foreground";

export const Input = forwardRef<TextInput, TextInputProps & { className?: string }>(function Input({ className, style, ...props }, ref) {
  const t = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={t.muted}
      className={cn(inputClass, className)}
      style={[{ fontFamily: "Inter_400Regular" }, style]}
      {...props}
    />
  );
});

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold">{label}</Text>
      {children}
      {hint ? <Text className="text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "green" | "yellow" | "red" | "blue"; children: ReactNode }) {
  const box = {
    neutral: "bg-border/60",
    green: "bg-bandeira-50 dark:bg-bandeira-500/15",
    yellow: "bg-ipe-100 dark:bg-ipe-500/20",
    red: "bg-pitanga-100 dark:bg-pitanga-500/15",
    blue: "bg-anil-700/10 dark:bg-anil-500/30",
  }[tone];
  const text = {
    neutral: "text-muted",
    green: "text-bandeira-700 dark:text-bandeira-100",
    yellow: "text-anil-900 dark:text-ipe-400",
    red: "text-pitanga-600",
    blue: "text-anil-700 dark:text-white",
  }[tone];
  return (
    <View className={cn("self-start rounded-full px-2.5 py-0.5", box)}>
      <Text className={cn("text-xs font-semibold", text)}>{children}</Text>
    </View>
  );
}

export function Alert({ kind = "error", children, className }: { kind?: "error" | "success" | "info"; children: ReactNode; className?: string }) {
  const t = useTheme();
  const Icon = kind === "error" ? CircleAlert : CircleCheck;
  const box = {
    error: "bg-pitanga-100 dark:bg-pitanga-500/15",
    success: "bg-bandeira-50 dark:bg-bandeira-500/15",
    info: "bg-ipe-100 dark:bg-ipe-500/15",
  }[kind];
  const text = { error: "text-pitanga-600", success: "text-bandeira-700 dark:text-bandeira-100", info: "text-anil-900 dark:text-ipe-400" }[kind];
  const color = kind === "error" ? t.pitanga600 : kind === "success" ? (t.dark ? t.bandeira100 : t.bandeira700) : t.dark ? t.ipe400 : t.anil900;
  return (
    <View accessibilityRole={kind === "error" ? "alert" : "text"} className={cn("flex-row items-start gap-2 rounded-2xl px-4 py-3", box, className)}>
      <Icon color={color} size={16} style={{ marginTop: 2 }} />
      <View className="flex-1">{typeof children === "string" ? <Text className={cn("text-sm", text)}>{children}</Text> : children}</View>
    </View>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } | null | undefined }) {
  if (state?.error) return <Alert>{state.error}</Alert>;
  if (state?.ok) return <Alert kind="success">{state.ok}</Alert>;
  return null;
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View className="items-center gap-2 rounded-3xl border-2 border-dashed border-border px-6 py-10">
      <Icon color={t.bandeira500} size={32} />
      <Text className="text-center font-display text-lg font-bold">{title}</Text>
      {children ? typeof children === "string" ? <Text className="text-center text-sm text-muted">{children}</Text> : children : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background py-20">
      <ActivityIndicator color={t.bandeira500} size="large" />
      {label ? <Text className="text-muted">{label}</Text> : null}
    </View>
  );
}

/** Linha clicável de lista (ícone, título, subtítulo, seta). */
export function Row({
  href,
  onPress,
  title,
  sub,
  left,
  right,
  className,
}: {
  href?: Href;
  onPress?: () => void;
  title: ReactNode;
  sub?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  const body = (
    <Pressable onPress={onPress} className={cn("flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 active:opacity-80", className)}>
      {left}
      <View className="min-w-0 flex-1">
        {typeof title === "string" ? <Text className="font-semibold" numberOfLines={2}>{title}</Text> : title}
        {sub ? typeof sub === "string" ? <Text className="text-sm text-muted">{sub}</Text> : sub : null}
      </View>
      {right}
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {body}
    </Link>
  ) : (
    body
  );
}

export function Section({ title, children, className, right }: { title: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <View className={cn("mb-6", className)}>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-display text-xl font-bold">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}
