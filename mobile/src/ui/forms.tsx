import { useState, type ReactNode } from "react";
import { FlatList, Modal, Pressable, View, type TextInputProps } from "react-native";
import { Check, ChevronDown, X } from "lucide-react-native";
import { cx as cn } from "./cn";
import { Field, Input, Text, useTheme } from "./index";

/** Campo com rótulo (como o Field do site). */
export function TextField({ label, hint, className, ...props }: TextInputProps & { label: string; hint?: string; className?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Input className={className} {...props} />
    </Field>
  );
}

/** "DD/MM/AAAA" ↔ "AAAA-MM-DD" (formato do banco, igual ao input date do site). */
export const isoToBr = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
export function brToIso(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
const maskDate = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
};

/** Data digitada com máscara; `value`/`onChange` em AAAA-MM-DD. */
export function DateField({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (iso: string) => void }) {
  const [text, setText] = useState(isoToBr(value));
  return (
    <Field label={label} hint={hint ?? "DD/MM/AAAA"}>
      <Input
        value={text}
        keyboardType="number-pad"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        onChangeText={(t) => {
          const m = maskDate(t);
          setText(m);
          onChange(brToIso(m));
        }}
      />
    </Field>
  );
}

/** "HH:MM" com máscara. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <Input
        value={value}
        keyboardType="number-pad"
        placeholder="HH:MM"
        maxLength={5}
        onChangeText={(t) => {
          const d = t.replace(/\D/g, "").slice(0, 4);
          onChange(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
        }}
      />
    </Field>
  );
}

export function Checkbox({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} className={cn("flex-row items-start gap-3", className)}>
      <View className={cn("mt-0.5 size-6 items-center justify-center rounded-md border-2", checked ? "border-bandeira-500 bg-bandeira-500" : "border-border bg-surface")}>
        {checked ? <Check color="#fff" size={16} /> : null}
      </View>
      <View className="flex-1">{typeof children === "string" ? <Text className="text-sm">{children}</Text> : children}</View>
    </Pressable>
  );
}

/** Abas/segmentos ("Semana | Mês", "Sou aluno | Sou Personal"). */
export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <View className={cn("flex-row gap-1 rounded-2xl bg-border/40 p-1", className)} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          className={cn("flex-1 items-center rounded-xl py-2", o.value === value && "bg-surface shadow-sm")}
        >
          <Text className={cn("font-display font-bold", o.value !== value && "text-muted")}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Seletor em lista (substitui o <select> do site). */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Escolha…",
}: {
  label?: string;
  value: T | "";
  options: { value: T; label: string; group?: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useTheme();
  const current = options.find((o) => o.value === value);
  const box = (
    <Pressable onPress={() => setOpen(true)} className="w-full flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
      <Text className={cn(!current && "text-muted")} numberOfLines={1}>
        {current?.label ?? placeholder}
      </Text>
      <ChevronDown color={t.muted} size={18} />
    </Pressable>
  );
  return (
    <>
      {label ? <Field label={label}>{box}</Field> : box}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)} />
        <View className="max-h-[70%] rounded-t-3xl bg-background pb-8">
          <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
            <Text className="font-display text-lg font-bold">{label ?? placeholder}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityLabel="Fechar" className="p-1">
              <X color={t.foreground} size={20} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item, index }) => (
              <View>
                {item.group && item.group !== options[index - 1]?.group ? <Text className="px-5 pt-3 text-xs font-bold uppercase text-muted">{item.group}</Text> : null}
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className={cn("flex-row items-center justify-between px-5 py-3.5 active:bg-border/40", item.value === value && "bg-bandeira-50 dark:bg-bandeira-500/15")}
                >
                  <Text className="flex-1">{item.label}</Text>
                  {item.value === value ? <Check color={t.bandeira500} size={18} /> : null}
                </Pressable>
              </View>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
