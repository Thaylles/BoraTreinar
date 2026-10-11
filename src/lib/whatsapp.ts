import { normalizePhoneBR } from "./phone.ts";

export const WHATSAPP_CONFIRM_MESSAGE = "Olá, tudo bem? Confirmado nosso treino hoje?";

/** Link wa.me com DDI 55 e mensagem codificada; null se o telefone for inválido. */
export function whatsappLink(phone: string | null | undefined, text = WHATSAPP_CONFIRM_MESSAGE): string | null {
  const n = normalizePhoneBR(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}
