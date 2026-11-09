import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import QRCode from "qrcode";
import { CheckCircle2, Copy, ExternalLink, Hourglass } from "lucide-react-native";
import { brl } from "@/lib/finance";
import { formatPixKey, pixPayload, type PixKeyType } from "@/lib/pix";
import { form } from "~/lib/api";
import { useCall } from "~/lib/use-action";
import { Button, Text, useTheme } from "~/ui";
import { Disclosure } from "~/ui/extras";

type Pix = { pix_key: string; key_type: PixKeyType; holder_name: string; city: string; payment_link: string | null };

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const t = useTheme();
  const [done, setDone] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        await Clipboard.setStringAsync(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className="flex-row items-center gap-2 rounded-2xl border-2 border-border bg-surface px-4 py-2"
    >
      {done ? <CheckCircle2 color={t.bandeira500} size={16} /> : <Copy color={t.foreground} size={16} />}
      <Text className="text-sm font-bold">{done ? "Copiado!" : label}</Text>
    </Pressable>
  );
}

/** Cobrança em aberto: QR Code / Pix copia e cola, link de pagamento e "Já paguei". */
export function PixPay({ payment, pix }: { payment: { id: string; amount: number; description: string; reported_paid_at?: string | null }; pix: Pix | null }) {
  const t = useTheme();
  const report = useCall("aluno/pagamento-actions#reportPayment");
  const code = pix ? pixPayload({ key: pix.pix_key, name: pix.holder_name, city: pix.city, amount: payment.amount, description: payment.description }) : null;
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    if (code) void QRCode.toString(code, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg).catch(() => setSvg(null));
  }, [code]);
  if (payment.reported_paid_at)
    return (
      <View className="mt-2 flex-row items-center gap-1.5">
        <Hourglass color={t.muted} size={14} />
        <Text className="text-xs font-semibold text-muted">Você avisou que pagou. Aguardando seu Personal confirmar.</Text>
      </View>
    );
  return (
    <View className="mt-2 rounded-2xl bg-bandeira-50 p-3 dark:bg-bandeira-500/10">
      <Disclosure label={`💠 Pagar ${brl(payment.amount)}`}>
        <View className="mt-3 gap-3">
          {code && pix ? (
            <>
              {svg ? (
                <View className="w-48 self-center rounded-2xl bg-white p-2" accessibilityLabel={`QR Code Pix de ${brl(payment.amount)}`}>
                  <SvgXml xml={svg} width="100%" height={176} />
                </View>
              ) : null}
              <Text className="text-center text-xs text-muted">
                Abra o app do banco → Pix → ler QR Code, ou copie o código abaixo.{"\n"}Recebedor: <Text className="text-xs font-bold">{pix.holder_name}</Text> · chave {formatPixKey(pix.key_type, pix.pix_key)}
              </Text>
              <View className="items-center">
                <CopyButton text={code} label="Copiar Pix copia e cola" />
              </View>
            </>
          ) : !pix?.payment_link ? (
            <Text className="text-sm text-muted">Seu Personal ainda não cadastrou o Pix. Combine o pagamento com ele.</Text>
          ) : null}
          {pix?.payment_link ? (
            <Pressable onPress={() => void Linking.openURL(pix.payment_link!)} className="flex-row items-center justify-center gap-1">
              <ExternalLink color={t.dark ? t.ipe500 : t.anil700} size={16} />
              <Text className="font-semibold text-anil-700 underline dark:text-ipe-500">Pagar pelo link do Personal</Text>
            </Pressable>
          ) : null}
          <View className="items-center border-t border-border pt-3">
            <Button size="sm" variant="secondary" icon={CheckCircle2} loading={report.pending} onPress={() => report.run(form({ id: payment.id }))}>
              Já paguei
            </Button>
          </View>
        </View>
      </Disclosure>
    </View>
  );
}
