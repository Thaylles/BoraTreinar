import { LOGO_SVG_INNER } from "./logo-svg";

type LogoMarkProps = { size?: number; className?: string };

/** Losango verde-amarelo com o halter no céu azul: releitura da bandeira (desenho em scripts/gerar-icones.py). */
export function LogoMark({ size = 40, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: LOGO_SVG_INNER }}
    />
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span
        className="font-display font-extrabold leading-none tracking-tight"
        style={{ fontSize: size * 0.6 }}
      >
        <span className="text-bandeira-500">Bora</span>
        <span className="text-anil-700 dark:text-ipe-500">Treinar</span>
      </span>
    </span>
  );
}
