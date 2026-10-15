"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { homeFor, safeNext } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { friendlyError, type ActionState } from "@/lib/errors";
import { normalizePhoneBR } from "@/lib/phone";
import { sendEmail } from "@/lib/email";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const MIN_PASSWORD = 8;

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: str(fd, "email"),
    password: String(fd.get("password") ?? ""),
  });
  if (error) return { error: friendlyError(error.message) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  redirect(safeNext(fd.get("next")) ?? (profile ? homeFor(profile.role) : "/"));
}

export async function signUpPersonal(_: ActionState, fd: FormData): Promise<ActionState> {
  const fullName = str(fd, "full_name");
  const password = String(fd.get("password") ?? "");
  const phoneRaw = str(fd, "phone");
  const phone = phoneRaw ? normalizePhoneBR(phoneRaw) : null;

  if (fullName.length < 2) return { error: "Informe seu nome." };
  if (password.length < MIN_PASSWORD) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (phoneRaw && !phone) return { error: "Telefone inválido. Use DDD + número." };
  if (fd.get("terms") !== "on") return { error: "É preciso aceitar o termo de uso e privacidade." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: str(fd, "email"),
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm?next=/personal`,
      data: { role: "personal", full_name: fullName, phone, terms_accepted: true },
    },
  });
  if (error) return { error: friendlyError(error.message) };
  return {
    ok: "Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirma lá e bora!",
  };
}

/** Aluno cria conta sozinho (sem convite). Confirma o e-mail e cai na vitrine de Personais. */
export async function signUpStudentOpen(_: ActionState, fd: FormData): Promise<ActionState> {
  const fullName = str(fd, "full_name");
  const password = String(fd.get("password") ?? "");
  const phone = normalizePhoneBR(str(fd, "phone"));
  const birthDate = str(fd, "birth_date") || null;

  if (fullName.length < 2) return { error: "Informe seu nome." };
  if (!phone) return { error: "Informe um WhatsApp válido com DDD." };
  if (password.length < MIN_PASSWORD) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (fd.get("terms") !== "on") return { error: "É preciso aceitar o termo de uso e privacidade." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: str(fd, "email"),
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm?next=/aluno/encontrar`,
      data: { role: "aluno", full_name: fullName, phone, birth_date: birthDate, terms_accepted: true },
    },
  });
  if (error) return { error: friendlyError(error.message) };
  return {
    ok: "Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirma lá e bora treinar!",
  };
}

export async function signUpStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = str(fd, "token");
  const fullName = str(fd, "full_name");
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  const phone = normalizePhoneBR(str(fd, "phone"));
  const birthDate = str(fd, "birth_date") || null;

  if (fullName.length < 2) return { error: "Informe seu nome." };
  if (!phone) return { error: "Informe um WhatsApp válido com DDD." };
  if (password.length < MIN_PASSWORD) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (fd.get("terms") !== "on") return { error: "É preciso aceitar o termo de uso e privacidade." };

  const supabase = await createClient();
  const { data: invite } = await supabase.rpc("get_invite_public", { p_token: token });
  if (invite?.[0]?.status !== "pendente") {
    return { error: "Esse convite não é mais válido. Peça um novo link ao seu Personal." };
  }

  const metadata = {
    role: "aluno",
    full_name: fullName,
    phone,
    birth_date: birthDate,
    invite_token: token,
    terms_accepted: true,
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Cadastro de alunos indisponível: o servidor não está configurado (SUPABASE_SERVICE_ROLE_KEY)." };
  }

  // O aluno chega por convite do Personal: conta já confirmada, entra direto.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) {
    if (/database error/i.test(error.message)) {
      return { error: "Não foi possível usar esse convite. Peça um novo link ao seu Personal." };
    }
    return { error: friendlyError(error.message) };
  }

  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) redirect("/entrar");
  redirect("/aluno?bemvindo=1");
}

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
  const done: ActionState = {
    ok: "Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha.",
  };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Informe um e-mail válido." };

  // Preferimos gerar o link no servidor e enviar pelo e-mail do app (Gmail): funciona em
  // qualquer navegador/aparelho (sem depender do navegador que pediu) e não esbarra no
  // limite de e-mails do Supabase.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
    if (error || !data.properties?.hashed_token) return done;
    const link = `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/redefinir-senha`;
    const html = `<div style="font-family:Arial,sans-serif;color:#10213f">
      <h2 style="color:#009C3B">Criar uma nova senha</h2>
      <p>Recebemos um pedido para redefinir a senha da sua conta no BoraTreinar.</p>
      <p><a href="${link}" style="display:inline-block;background:#009C3B;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Criar nova senha</a></p>
      <p style="color:#5b6478;font-size:13px">O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail.</p>
    </div>`;
    if (await sendEmail(email, "Redefinir sua senha — BoraTreinar", html)) return done;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/confirm?next=/redefinir-senha`,
  });
  if (error) return { error: friendlyError(error.message) };
  return done;
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyError(error.message) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  redirect(profile ? homeFor(profile.role) : "/");
}

/** Botão da página /confirmar: valida o link do e-mail (token_hash) e entra na conta. */
export async function confirmEmailLink(fd: FormData) {
  const tokenHash = str(fd, "token_hash");
  const type = str(fd, "type");
  const next = safeNext(fd.get("next")) ?? "/painel";
  if (!tokenHash || !["recovery", "signup", "email", "invite", "magiclink", "email_change"].includes(type)) {
    redirect("/entrar?erro=link");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: type as "recovery", token_hash: tokenHash });
  redirect(error ? "/entrar?erro=link" : next);
}
