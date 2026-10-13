export const AVATAR_BUCKET = "avatars";

/** URL pública da foto de perfil (ou null se a pessoa não tem foto). */
export function avatarUrl(path: string | null | undefined): string | null {
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}` : null;
}
