import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Token do app Android (React Native): chega em "Authorization: Bearer <jwt>" nas rotas /api/mobile.
 * Com ele, o cliente fala com o Supabase como esse usuário (RLS igual ao site) e
 * `auth.getUser()` valida o token, então as mesmas ações do servidor servem ao app.
 */
async function bearerToken(): Promise<string | null> {
  try {
    const auth = (await headers()).get("authorization");
    const m = auth?.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
  } catch {
    return null; // fora de uma requisição (ex.: build)
  }
}

export async function createClient() {
  const token = await bearerToken();
  if (token) {
    const client = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => [], setAll: () => {} },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const getUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = (jwt?: string) => getUser(jwt ?? token);
    return client;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component: o middleware renova a sessão.
          }
        },
      },
    },
  );
}
