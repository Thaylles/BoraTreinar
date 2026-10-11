import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";
import { spDateKey } from "@/lib/week";

// Agendado no vercel.json: "0 10 * * *" (UTC) = 7h em America/Sao_Paulo.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const date = spDateKey();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("daily_class_reminders", { p_date: date });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let emails = 0;
  for (const r of data ?? []) {
    // Só envia e-mail quando a notificação é nova (evita duplicar se o cron rodar duas vezes).
    if (!r.notified || !r.personal_email) continue;
    const items = r.classes as { time: string; student_name: string; phone: string | null }[];
    const rows = items
      .map((c) => {
        const wa = whatsappLink(c.phone);
        return `<tr><td style="padding:8px 12px;font-weight:700">${escapeHtml(c.time)}</td><td style="padding:8px 12px">${escapeHtml(c.student_name)}</td><td style="padding:8px 12px">${
          wa ? `<a href="${wa}" style="color:#0b3d1f;background:#25D366;padding:6px 10px;border-radius:10px;text-decoration:none;font-weight:700">WhatsApp</a>` : ""
        }</td></tr>`;
      })
      .join("");
    const html = `<div style="font-family:Arial,sans-serif;color:#10213f">
      <h2 style="color:#009C3B">Bom dia, ${escapeHtml(r.personal_name.split(" ")[0])}! ☀️</h2>
      <p>Hoje você tem <strong>${items.length} ${items.length === 1 ? "aula" : "aulas"}</strong>. Que tal mandar uma mensagem para confirmar?</p>
      <table style="border-collapse:collapse">${rows}</table>
      <p><a href="${appUrl}/personal/agenda?dia=${date}">Abrir a agenda no BoraTreinar</a></p>
    </div>`;
    if (await sendEmail(r.personal_email, `Hoje: ${items.length} ${items.length === 1 ? "aula" : "aulas"} — BoraTreinar`, html)) emails++;
  }

  return NextResponse.json({ ok: true, date, personais: data?.length ?? 0, emails });
}
