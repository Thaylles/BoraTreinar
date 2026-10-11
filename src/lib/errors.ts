const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar. Dá uma olhada na caixa de entrada (e no spam)."],
  [/already (been )?registered|already exists/i, "Já existe uma conta com esse e-mail."],
  [/password should be at least/i, "A senha precisa ter pelo menos 8 caracteres."],
  [/weak password|pwned/i, "Essa senha é muito fraca ou já vazou em outros sites. Escolha outra."],
  [/rate limit|too many/i, "Muitas tentativas. Espera um pouquinho e tenta de novo."],
  [/unable to validate email|invalid email/i, "E-mail inválido."],
  [/same password|different from the old/i, "A nova senha precisa ser diferente da atual."],
];

/** Traduz mensagens do Supabase/Postgres para algo amigável em pt-BR. */
export function friendlyError(message: string | undefined | null): string {
  if (!message) return "Algo deu errado. Tenta de novo?";
  for (const [re, msg] of AUTH_MESSAGES) if (re.test(message)) return msg;
  // Exceções levantadas nas funções SQL já vêm em português.
  if (/[áéíóúãõç]/i.test(message) || /^[A-ZÁÉÍÓÚ][a-zà-ú ]+/.test(message)) return message;
  return "Algo deu errado. Tenta de novo?";
}

export type ActionState = { error?: string; ok?: string } | undefined;
