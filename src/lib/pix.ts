/** Pix estático (BR Code / "Pix copia e cola") a partir da chave do Personal (funções puras). */

export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export const PIX_KEY_TYPES: {
  value: PixKeyType;
  label: string;
  placeholder: string;
}[] = [
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { value: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { value: "email", label: "E-mail", placeholder: "voce@email.com" },
  { value: "telefone", label: "Celular", placeholder: "(11) 98888-7777" },
  {
    value: "aleatoria",
    label: "Chave aleatória",
    placeholder: "123e4567-e89b-12d3-a456-426614174000",
  },
];

const digits = (s: string) => s.replace(/\D/g, "");

function validCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    return ((sum * 10) % 11) % 10;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function validCnpj(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = w.reduce((s, x, i) => s + x * Number(d[i]), 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/** Normaliza a chave no formato do Pix ou devolve o erro para mostrar ao Personal. */
export function normalizePixKey(type: PixKeyType, raw: string): { key: string } | { error: string } {
  const v = raw.trim();
  switch (type) {
    case "cpf": {
      const d = digits(v);
      return validCpf(d) ? { key: d } : { error: "CPF inválido." };
    }
    case "cnpj": {
      const d = digits(v);
      return validCnpj(d) ? { key: d } : { error: "CNPJ inválido." };
    }
    case "email": {
      const e = v.toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 77 ? { key: e } : { error: "E-mail inválido." };
    }
    case "telefone": {
      let d = digits(v);
      if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
      return /^\d{2}9?\d{8}$/.test(d) ? { key: `+55${d}` } : { error: "Celular inválido. Use DDD + número." };
    }
    case "aleatoria": {
      const k = v.toLowerCase();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k) ? { key: k } : { error: "Chave aleatória inválida." };
    }
  }
}

/** Chave para mostrar ("123.456.789-09", "(11) 98888-7777"…). */
export function formatPixKey(type: PixKeyType, key: string): string {
  if (type === "cpf") return key.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (type === "cnpj") return key.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (type === "telefone") return key.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
  return key;
}

/** Texto aceito no BR Code: sem acento, só caracteres simples, cortado no tamanho. */
const ascii = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,\-/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no campo 63 do BR Code. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * "Pix copia e cola" estático com valor. Qualquer app de banco lê (colando ou pelo QR Code).
 * Nome até 25 e cidade até 15 caracteres, como pede o padrão do Banco Central.
 */
export function pixPayload(p: { key: string; name: string; city: string; amount?: number | null; description?: string | null }): string {
  const desc = p.description ? ascii(p.description, 40) : "";
  const account = field("00", "br.gov.bcb.pix") + field("01", p.key) + (desc ? field("02", desc) : "");
  const body =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (p.amount && p.amount > 0 ? field("54", p.amount.toFixed(2)) : "") +
    field("58", "BR") +
    field("59", ascii(p.name, 25) || "RECEBEDOR") +
    field("60", ascii(p.city, 15) || "BRASIL") +
    field("62", field("05", "***")) +
    "6304";
  return body + crc16(body);
}
