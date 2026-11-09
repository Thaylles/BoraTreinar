import { useState } from "react";
import { View } from "react-native";
import { brl, classesPerMonth, packageSummary, parseMoney, pricePerClass, type PackageKind } from "@/lib/finance";
import { formatPixKey, PIX_KEY_TYPES, type PixKeyType } from "@/lib/pix";
import { useFormAction } from "~/lib/use-action";
import { Button, FormMessage, Input, Text } from "~/ui";
import { Select, TextField } from "~/ui/forms";

export function PackageForm() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PackageKind>("mensal");
  const [perWeek, setPerWeek] = useState("2");
  const [price, setPrice] = useState("");
  const { state, pending, submit } = useFormAction("personal/financeiro#createPackage");
  const value = parseMoney(price);
  return (
    <View className="gap-3">
      <TextField label="Nome do pacote" value={name} onChangeText={setName} maxLength={60} placeholder="Ex.: 2x por semana" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Select label="Tipo" value={kind} onChange={(v) => setKind(v as PackageKind)} options={[{ value: "mensal", label: "Mensal" }, { value: "por_aula", label: "Por aula (diária)" }]} />
        </View>
        {kind === "mensal" ? (
          <View className="flex-1">
            <Select label="Aulas por semana" value={perWeek} onChange={setPerWeek} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `${n}x` }))} />
          </View>
        ) : null}
      </View>
      <TextField label={kind === "mensal" ? "Valor por mês (R$)" : "Valor da aula (R$)"} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder={kind === "mensal" ? "350" : "50"} />
      {kind === "mensal" && value ? (
        <Text className="text-sm text-muted">
          ≈ {classesPerMonth(Number(perWeek))} aulas no mês · <Text className="text-sm font-bold">{brl(pricePerClass({ kind, price: value, classes_per_week: Number(perWeek) }))} por aula</Text>
        </Text>
      ) : null}
      <FormMessage state={state} />
      <Button
        className="self-start"
        loading={pending}
        onPress={async () => {
          const r = await submit({ name, kind, classes_per_week: kind === "mensal" ? perWeek : undefined, price });
          if ((r?.result as { ok?: string } | null)?.ok) {
            setName("");
            setPrice("");
          }
        }}
      >
        Criar pacote
      </Button>
    </View>
  );
}

export type PixSettings = { key_type: PixKeyType; pix_key: string; holder_name: string; city: string; payment_link: string | null };

export function PixForm({ current, defaultName }: { current: PixSettings | null; defaultName: string }) {
  const [type, setType] = useState<PixKeyType>(current?.key_type ?? "cpf");
  const [key, setKey] = useState(current ? formatPixKey(current.key_type, current.pix_key) : "");
  const [holder, setHolder] = useState(current?.holder_name ?? defaultName);
  const [city, setCity] = useState(current?.city ?? "");
  const [link, setLink] = useState(current?.payment_link ?? "");
  const { state, pending, submit } = useFormAction("personal/financeiro#savePix");
  const placeholder = PIX_KEY_TYPES.find((x) => x.value === type)?.placeholder;
  return (
    <View className="gap-3">
      <Select label="Tipo de chave" value={type} onChange={(v) => { setType(v as PixKeyType); setKey(current?.key_type === v ? formatPixKey(current.key_type, current.pix_key) : ""); }} options={PIX_KEY_TYPES.map((x) => ({ value: x.value, label: x.label }))} />
      <TextField label="Chave Pix" value={key} onChangeText={setKey} maxLength={80} placeholder={placeholder} autoCapitalize="none" keyboardType={type === "cpf" || type === "cnpj" || type === "telefone" ? "number-pad" : type === "email" ? "email-address" : "default"} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextField label="Nome de quem recebe" value={holder} onChangeText={setHolder} maxLength={60} />
        </View>
        <View className="flex-1">
          <TextField label="Cidade" value={city} onChangeText={setCity} maxLength={40} placeholder="São Paulo" />
        </View>
      </View>
      <TextField label="Link de pagamento (opcional)" value={link} onChangeText={setLink} maxLength={300} placeholder="https://… (cartão, Mercado Pago, PicPay…)" autoCapitalize="none" keyboardType="url" hint="Para quem prefere pagar com cartão. Aparece como botão ao lado do Pix." />
      <FormMessage state={state} />
      <Button className="self-start" loading={pending} onPress={() => submit({ key_type: type, pix_key: key, holder_name: holder, city, payment_link: link })}>
        {current ? "Atualizar Pix" : "Salvar Pix"}
      </Button>
    </View>
  );
}

type Pkg = { id: string; name: string; kind: PackageKind; price: number; classes_per_week: number | null };
export function BillingForm({ studentId, packages, current }: { studentId: string; packages: Pkg[]; current?: { package_id: string | null; label: string; kind: PackageKind; amount: number; due_day: number } | null }) {
  const [pkg, setPkg] = useState(current ? (current.package_id ?? "custom") : (packages[0]?.id ?? "custom"));
  const [kind, setKind] = useState<PackageKind>(current?.kind ?? "mensal");
  const [amount, setAmount] = useState(current && !current.package_id ? String(current.amount).replace(".", ",") : "");
  const [day, setDay] = useState(String(current?.due_day ?? 10));
  const { state, pending, submit } = useFormAction("personal/financeiro#saveBilling");
  const custom = pkg === "custom";
  return (
    <View className="gap-3">
      <Select label="Pacote" value={pkg} onChange={setPkg} options={[...packages.map((p) => ({ value: p.id, label: `${p.name} — ${packageSummary(p)}` })), { value: "custom", label: "Valor personalizado…" }]} />
      {custom ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Select label="Cobrança" value={kind} onChange={(v) => setKind(v as PackageKind)} options={[{ value: "mensal", label: "Valor fixo por mês" }, { value: "por_aula", label: "Por aula dada" }]} />
          </View>
          <View className="flex-1">
            <TextField label={kind === "mensal" ? "Valor/mês (R$)" : "Valor/aula (R$)"} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>
        </View>
      ) : null}
      <Select label="Dia do pagamento" value={day} onChange={setDay} options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Todo dia ${i + 1}` }))} />
      <Text className="text-xs text-muted">O aluno recebe um lembrete 1 dia antes, no dia e no dia seguinte (se ainda não tiver pago).</Text>
      <FormMessage state={state} />
      <Button
        size="sm"
        className="self-start"
        loading={pending}
        onPress={() => submit({ student_id: studentId, package_id: pkg, kind: custom ? kind : undefined, amount: custom ? amount : undefined, label: custom ? (kind === "mensal" ? "Mensalidade" : "Aulas avulsas") : undefined, due_day: day })}
      >
        Salvar plano
      </Button>
    </View>
  );
}

export function AmountForm({ id, amount }: { id: string; amount: number }) {
  const [v, setV] = useState(amount.toFixed(2).replace(".", ","));
  const { state, pending, submit } = useFormAction("personal/financeiro#setPaymentAmount");
  return (
    <View className="mt-2 gap-2">
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <Text className="mb-1 text-xs font-semibold">Novo valor (R$)</Text>
          <Input value={v} onChangeText={setV} keyboardType="decimal-pad" />
        </View>
        <Button size="sm" variant="secondary" loading={pending} onPress={() => submit({ id, amount: v })}>
          Ajustar
        </Button>
      </View>
      <FormMessage state={state} />
    </View>
  );
}
