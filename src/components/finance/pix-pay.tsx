import QRCode from "qrcode";
import { CheckCircle2, ExternalLink, Hourglass } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { reportPayment } from "@/app/aluno/pagamento-actions";
import { brl } from "@/lib/finance";
import { formatPixKey, pixPayload } from "@/lib/pix";
import type { PixSettings } from "@/components/finance/pix-form";

/** Cobrança em aberto: QR Code / Pix copia e cola com o valor, link de pagamento e "Já paguei". */
export async function PixPay({
  payment,
  pix,
}: {
  payment: {
    id: string;
    amount: number;
    description: string;
    reported_paid_at?: string | null;
  };
  pix: PixSettings | null;
}) {
  if (payment.reported_paid_at) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Hourglass className="size-3.5" aria-hidden /> Você avisou que pagou. Aguardando seu Personal confirmar.
      </p>
    );
  }
  const code = pix
    ? pixPayload({
        key: pix.pix_key,
        name: pix.holder_name,
        city: pix.city,
        amount: payment.amount,
        description: payment.description,
      })
    : null;
  const svg = code
    ? await QRCode.toString(code, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
      })
    : null;
  return (
    <details className="mt-2 rounded-2xl bg-bandeira-50 p-3 text-sm dark:bg-bandeira-500/10">
      <summary className="cursor-pointer font-semibold">💠 Pagar {brl(payment.amount)}</summary>
      <div className="mt-3 space-y-3">
        {code && svg && pix ? (
          <>
            <div
              className="mx-auto w-48 rounded-2xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
              role="img"
              aria-label={`QR Code Pix de ${brl(payment.amount)}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="text-center text-xs text-muted">
              Abra o app do banco → Pix → ler QR Code, ou copie o código abaixo.
              <br />
              Recebedor: <strong className="text-foreground">{pix.holder_name}</strong> · chave {formatPixKey(pix.key_type, pix.pix_key)}
            </p>
            <div className="flex justify-center">
              <CopyButton text={code} label="Copiar Pix copia e cola" />
            </div>
          </>
        ) : (
          !pix?.payment_link && <p className="text-muted">Seu Personal ainda não cadastrou o Pix. Combine o pagamento com ele.</p>
        )}
        {pix?.payment_link && (
          <a
            href={pix.payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 font-semibold text-anil-700 underline dark:text-ipe-500"
          >
            <ExternalLink className="size-4" aria-hidden /> Pagar pelo link do Personal
          </a>
        )}
        <form action={reportPayment} className="flex justify-center border-t border-border pt-3">
          <input type="hidden" name="id" value={payment.id} />
          <Button size="sm" variant="secondary">
            <CheckCircle2 className="size-4" aria-hidden /> Já paguei
          </Button>
        </form>
      </div>
    </details>
  );
}
