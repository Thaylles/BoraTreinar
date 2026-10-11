import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let gmail: Transporter | null | undefined;

/** Transporte SMTP do Gmail (GMAIL_USER + GMAIL_APP_PASSWORD, uma "senha de app" do Google). */
function gmailTransport(): Transporter | null {
  if (gmail !== undefined) return gmail;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  gmail = user && pass ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } }) : null;
  return gmail;
}

async function viaResend(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) console.error("Falha ao enviar e-mail (Resend):", res.status, await res.text().catch(() => ""));
  return res.ok;
}

/**
 * Envia e-mail. Com GMAIL_USER/GMAIL_APP_PASSWORD, usa o Gmail (funciona sem domínio próprio);
 * senão, o Resend (RESEND_API_KEY/EMAIL_FROM). Sem nenhum dos dois, não faz nada e retorna false.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const transport = gmailTransport();
  if (transport) {
    try {
      await transport.sendMail({ from: `"BoraTreinar" <${process.env.GMAIL_USER}>`, to, subject, html });
      return true;
    } catch (e) {
      console.error("Falha ao enviar e-mail (Gmail):", e instanceof Error ? e.message : e);
      return false;
    }
  }
  return viaResend(to, subject, html);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
