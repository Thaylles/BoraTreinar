import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let gmail: Transporter | null | undefined;

/** Transporte SMTP do Gmail (GMAIL_USER + GMAIL_APP_PASSWORD, uma "senha de app" do Google). */
function gmailTransport(): Transporter | null {
  if (gmail !== undefined) return gmail;
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  gmail = user && pass ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } }) : null;
  return gmail;
}

export type EmailResult = { ok: boolean; via: "gmail" | "resend" | null; error?: string };

/** Traduz os erros mais comuns do Gmail para algo acionável. */
function gmailError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  if (err.code === "EAUTH" || err.responseCode === 535 || err.responseCode === 534) {
    return "O Gmail recusou o login. Confira GMAIL_USER (o endereço completo) e GMAIL_APP_PASSWORD (a senha de app de 16 letras, não a senha normal) e se a verificação em duas etapas está ativa.";
  }
  if (err.code === "ETIMEDOUT" || err.code === "ECONNECTION" || err.code === "ESOCKET") {
    return "Não foi possível conectar ao Gmail (smtp.gmail.com). Tente de novo em alguns minutos.";
  }
  if (err.responseCode === 550 || err.responseCode === 553) return "O Gmail recusou o destinatário ou o remetente.";
  return err.message ?? "Erro desconhecido no envio pelo Gmail.";
}

async function viaResend(to: string, subject: string, html: string): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, via: null, error: "Nenhum serviço de e-mail configurado (GMAIL_* ou RESEND_API_KEY/EMAIL_FROM)." };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (res.ok) return { ok: true, via: "resend" };
  const detail = await res.text().catch(() => "");
  console.error("Falha ao enviar e-mail (Resend):", res.status, detail);
  return { ok: false, via: "resend", error: `Resend respondeu ${res.status}: ${detail.slice(0, 200)}` };
}

/**
 * Envia e-mail e diz por onde e, se falhar, o motivo. Com GMAIL_USER/GMAIL_APP_PASSWORD usa o
 * Gmail (funciona sem domínio próprio); senão, o Resend (RESEND_API_KEY/EMAIL_FROM).
 */
export async function sendEmailDetailed(to: string, subject: string, html: string): Promise<EmailResult> {
  const transport = gmailTransport();
  if (transport) {
    try {
      await transport.sendMail({ from: `"BoraTreinar" <${process.env.GMAIL_USER?.trim()}>`, to, subject, html });
      return { ok: true, via: "gmail" };
    } catch (e) {
      const error = gmailError(e);
      console.error("Falha ao enviar e-mail (Gmail):", error);
      return { ok: false, via: "gmail", error };
    }
  }
  return viaResend(to, subject, html);
}

/** Envia e-mail; retorna true se saiu. Sem serviço configurado, não faz nada e retorna false. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  return (await sendEmailDetailed(to, subject, html)).ok;
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
