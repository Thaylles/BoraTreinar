import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

/**
 * Destino dos links de e-mail (confirmação de cadastro e recuperação de senha).
 * Aceita tanto o fluxo PKCE (?code=) quanto token_hash (templates customizados).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next")) ?? "/painel";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Links com token_hash não são usados aqui no GET: leitores de e-mail (ex.: Outlook/Hotmail)
  // abrem os links antes da pessoa e gastariam o link de uso único. A pessoa confirma num botão.
  if (tokenHash && type) {
    const url = new URL("/confirmar", origin);
    url.search = new URLSearchParams({ token_hash: tokenHash, type, next }).toString();
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/entrar?erro=link", origin));
}
