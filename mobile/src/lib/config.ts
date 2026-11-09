/** Endereços do backend. Em desenvolvimento dá para apontar para o Supabase/site locais via EXPO_PUBLIC_*. */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://ktuxnblexodzvyhttnqp.supabase.co";
// Chave pública (anon): a mesma que o site entrega ao navegador; o acesso é protegido pelo RLS.
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0dXhuYmxleG9kenZ5aHR0bnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2Mjc5NDMsImV4cCI6MjEwNzIwMzk0M30.619ZPN4gxAZWm65E9A7HlrhLWRytvBXUIO0c4rOkwpQ";
/** Site (ações do servidor, PDF, e-mails, IA). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://bora-treinar-gamma.vercel.app").replace(/\/$/, "");

// O código compartilhado com o site lê estas variáveis (fotos do Storage, links do app).
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
process.env.NEXT_PUBLIC_APP_URL = API_URL;
// Fotos do catálogo com caminho do site (/catalogo/fotos/…) passam a usar o endereço completo.
process.env.NEXT_PUBLIC_ASSET_ORIGIN = API_URL;
