import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NavLinks, type NavItem } from "./nav-links";
import { firstName } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { avatarUrl } from "@/lib/avatar";

export function AppShell({
  name,
  avatarPath = null,
  roleLabel,
  root,
  items,
  isAdmin = false,
  canTrain = false,
  profileHref,
  brand = null,
  children,
}: {
  name: string;
  /** Foto de perfil (bucket avatars). */
  avatarPath?: string | null;
  roleLabel: string;
  root: string;
  items: NavItem[];
  /** Conta admin: mostra o seletor de modo (Admin / Personal / Aluno). */
  isAdmin?: boolean;
  /** Conta de Personal: mostra as abas Personal / Meu treino. */
  canTrain?: boolean;
  /** Link do perfil (padrão: `${root}/perfil`). */
  profileHref?: string;
  /** Marca do Personal (Premium): logo no lugar do BoraTreinar no app do aluno. */
  brand?: { logoPath: string; name: string } | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-surface p-4 md:flex md:flex-col md:gap-6">
        <Link href={root}>{brand ? <BrandLogo brand={brand} size="lg" /> : <Logo size={32} />}</Link>
        <NavLinks items={items} root={root} />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <Link href={root} className="min-w-0 md:hidden">
            {brand ? <BrandLogo brand={brand} /> : <Logo size={28} />}
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href={profileHref ?? `${root}/perfil`}
              className="flex items-center gap-2 rounded-full py-0.5 pl-3 pr-0.5 hover:bg-ipe-100 dark:hover:bg-surface"
              aria-label="Meu perfil"
              title="Meu perfil"
            >
              <span className="text-right leading-tight">
                <span className="block text-sm font-semibold">{firstName(name)}</span>
                <span className="block text-xs text-muted">{roleLabel}</span>
              </span>
              <Avatar path={avatarPath} name={name} size={36} />
            </Link>
            <form action="/sair" method="post">
              <button
                type="submit"
                className="rounded-full p-2 text-muted hover:bg-ipe-100 hover:text-foreground dark:hover:bg-surface"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
            </form>
          </div>
        </header>
        {isAdmin ? <ModeSwitcher root={root} modes={ADMIN_MODES} /> : canTrain && <ModeSwitcher root={root} modes={PERSONAL_MODES} label="Área:" />}

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 md:pb-10">{children}</main>

        <div className="md:hidden">
          <NavLinks items={items} root={root} />
        </div>
      </div>
    </div>
  );
}

const ADMIN_MODES = [
  { href: "/admin", label: "Admin" },
  { href: "/personal", label: "Personal" },
  { href: "/aluno", label: "Aluno" },
];

const PERSONAL_MODES = [
  { href: "/personal", label: "👥 Meus alunos" },
  { href: "/aluno", label: "🏋️ Meu treino" },
];

/** Troca de modo da conta: as áreas usam a mesma conta (admin: três; Personal: alunos e o próprio treino). */
function ModeSwitcher({ root, modes, label = "Modo:" }: { root: string; modes: { href: string; label: string }[]; label?: string }) {
  return (
    <nav aria-label="Modo da conta" className="sticky top-[57px] z-10 flex items-center gap-2 border-b border-border bg-anil-700 px-4 py-1.5 text-xs text-white">
      <span className="font-semibold text-white/75">{label}</span>
      {modes.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          aria-current={root === m.href ? "page" : undefined}
          className={
            root === m.href
              ? "rounded-full bg-ipe-500 px-3 py-1 font-bold text-anil-900"
              : "rounded-full px-3 py-1 font-semibold text-white hover:bg-white/15"
          }
        >
          {m.label}
        </Link>
      ))}
    </nav>
  );
}

/** Logo do Personal num fundo claro (funciona no tema escuro), com "via BoraTreinar" discreto. */
function BrandLogo({ brand, size = "md" }: { brand: { logoPath: string; name: string }; size?: "md" | "lg" }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={size === "lg" ? "flex h-12 items-center rounded-xl bg-white px-2 py-1" : "flex h-9 items-center rounded-lg bg-white px-2 py-1"}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo do bucket público */}
        <img
          src={avatarUrl(brand.logoPath)!}
          alt={brand.name}
          className={size === "lg" ? "max-h-10 max-w-[180px] object-contain" : "max-h-7 max-w-[140px] object-contain"}
        />
      </span>
      <span className="hidden text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted min-[380px]:block">
        via
        <br />
        BoraTreinar
      </span>
    </span>
  );
}
