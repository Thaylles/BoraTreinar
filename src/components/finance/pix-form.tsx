"use client";

import { startTransition, useActionState, useState } from "react";
import { savePix } from "@/app/personal/financeiro/actions";
import { Field, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatPixKey, PIX_KEY_TYPES, type PixKeyType } from "@/lib/pix";

export type PixSettings = {
  key_type: PixKeyType;
  pix_key: string;
  holder_name: string;
  city: string;
  payment_link: string | null;
};

/** Chave Pix do Personal (o app gera o QR Code de cada cobrança) e link de pagamento opcional. */
export function PixForm({ current, defaultName }: { current: PixSettings | null; defaultName: string }) {
  const [state, action, pending] = useActionState(savePix, undefined);
  const [type, setType] = useState<PixKeyType>(current?.key_type ?? "cpf");
  const placeholder = PIX_KEY_TYPES.find((t) => t.value === type)?.placeholder;
  return (
    <form
      className="space-y-3"
      // Envia sem o reset automático do React: num erro, o que foi digitado continua no formulário.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
        <label className="min-w-0 space-y-1.5 text-sm font-semibold">
          <span className="block">Tipo de chave</span>
          <select name="key_type" value={type} onChange={(e) => setType(e.target.value as PixKeyType)} className={inputClass}>
            {PIX_KEY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Chave Pix"
          name="pix_key"
          required
          maxLength={80}
          placeholder={placeholder}
          inputMode={type === "cpf" || type === "cnpj" || type === "telefone" ? "numeric" : type === "email" ? "email" : "text"}
          defaultValue={current && current.key_type === type ? formatPixKey(current.key_type, current.pix_key) : ""}
          key={type}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome de quem recebe" name="holder_name" required maxLength={60} defaultValue={current?.holder_name ?? defaultName} />
        <Field label="Cidade" name="city" required maxLength={40} placeholder="São Paulo" defaultValue={current?.city ?? ""} />
      </div>
      <Field
        label="Link de pagamento (opcional)"
        name="payment_link"
        type="url"
        maxLength={300}
        placeholder="https://… (cartão, Mercado Pago, PicPay…)"
        defaultValue={current?.payment_link ?? ""}
        hint="Para quem prefere pagar com cartão. Aparece como botão ao lado do Pix."
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Salvando…" : current ? "Atualizar Pix" : "Salvar Pix"}
      </Button>
    </form>
  );
}
