type LogoMarkProps = { size?: number; className?: string };

/** Losango verde-amarelo com halter: releitura da bandeira. */
export function LogoMark({ size = 40, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="112" fill="#009C3B" />
      <path d="M256 70 L452 256 L256 442 L60 256 Z" fill="#FFC72C" />
      <circle cx="256" cy="256" r="118" fill="#002776" />
      <g fill="#FFFFFF">
        <rect x="176" y="243" width="160" height="26" rx="8" />
        <rect x="160" y="206" width="30" height="100" rx="10" />
        <rect x="322" y="206" width="30" height="100" rx="10" />
        <rect x="134" y="222" width="22" height="68" rx="8" />
        <rect x="356" y="222" width="22" height="68" rx="8" />
      </g>
    </svg>
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
