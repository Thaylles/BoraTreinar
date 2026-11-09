import { NextResponse, type NextRequest } from "next/server";
import { MODULES } from "./registry";

/**
 * Ponte do app Android (React Native) para as mesmas ações do servidor do site.
 *
 * POST { action: "aluno/peso#saveWeight", args: [...] } com "Authorization: Bearer <jwt do Supabase>".
 * - O cliente do Supabase no servidor usa o token (ver lib/supabase/server.ts): RLS e checagens
 *   de papel são as mesmas do site.
 * - Argumento { __form: { campo: valor | { __file: { name, type, base64 } } } } vira FormData.
 * - redirect() vira { redirect: "/caminho" }; notFound() vira { notFound: true }.
 */
// Gerar foto/vídeo com IA pode levar até ~40 s.
export const maxDuration = 120;

/** Ações que funcionam sem login (cadastro e recuperação de senha). */
const PUBLIC_ACTIONS = new Set(["auth#signUpPersonal", "auth#signUpStudentOpen", "auth#signUpStudent", "auth#requestPasswordReset"]);

type FileArg = { __file: { name: string; type: string; base64: string } };
type FormArg = { __form: Record<string, string | string[] | FileArg | null> };

function toArg(a: unknown): unknown {
  if (a && typeof a === "object" && "__form" in a) {
    const fd = new FormData();
    for (const [k, v] of Object.entries((a as FormArg).__form)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
      else if (typeof v === "object" && "__file" in v) {
        const f = v.__file;
        fd.append(k, new File([Buffer.from(f.base64, "base64")], f.name, { type: f.type }));
      } else fd.append(k, String(v));
    }
    return fd;
  }
  return a;
}

function nextControl(e: unknown) {
  const digest = (e as { digest?: string })?.digest;
  if (typeof digest !== "string") return null;
  if (digest.startsWith("NEXT_REDIRECT")) return { redirect: digest.split(";")[2] ?? "/" };
  if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404") || digest === "NEXT_NOT_FOUND") return { notFound: true };
  return null;
}

/** Só em desenvolvimento: a prévia web do app (outra porta) chama esta rota. O app Android não precisa de CORS. */
const DEV_CORS: Record<string, string> =
  process.env.NODE_ENV === "production"
    ? {}
    : { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: DEV_CORS });
}

export async function POST(request: NextRequest) {
  const res = await handle(request);
  for (const [k, v] of Object.entries(DEV_CORS)) res.headers.set(k, v);
  return res;
}

async function handle(request: NextRequest) {
  let body: { action?: string; args?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const signedIn = /^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "");
  if (!signedIn && !PUBLIC_ACTIONS.has(String(body.action))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const [mod, fn] = String(body.action ?? "").split("#");
  const mod_ = (MODULES as Record<string, Record<string, unknown>>)[mod];
  const action = mod_ && Object.hasOwn(mod_, fn) ? mod_[fn] : undefined;
  if (typeof action !== "function") return NextResponse.json({ error: "Ação desconhecida" }, { status: 404 });

  try {
    const result = await (action as (...a: unknown[]) => Promise<unknown>)(...(body.args ?? []).map(toArg));
    return NextResponse.json({ result: result ?? null });
  } catch (e) {
    const ctl = nextControl(e);
    if (ctl) return NextResponse.json(ctl);
    console.error("mobile action", body.action, e);
    return NextResponse.json({ error: (e as Error)?.message || "Erro no servidor" }, { status: 500 });
  }
}
