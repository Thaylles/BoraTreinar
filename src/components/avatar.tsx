import { avatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/cn";

/** Foto de perfil redonda; sem foto, mostra a inicial do nome. */
export function Avatar({
  path,
  name,
  size = 44,
  className,
}: {
  path?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const src = avatarUrl(path);
  const style = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto pública do Storage, já comprimida
      <img src={src} alt="" style={style} className={cn("shrink-0 rounded-full object-cover", className)} loading="lazy" />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: Math.round(size * 0.4) }}
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-bandeira-50 font-display font-bold text-bandeira-700 dark:bg-bandeira-500/15 dark:text-bandeira-100",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
