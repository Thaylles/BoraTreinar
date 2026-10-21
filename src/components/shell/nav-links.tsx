"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, ChartLine, Dumbbell, Film, History, House, Inbox, Scale, Ticket, UserRound, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = { chart: ChartLine, calendar: CalendarDays, scale: Scale, history: History, dumbbell: Dumbbell, house: House, users: Users, ticket: Ticket, inbox: Inbox, user: UserRound, bell: Bell, wallet: Wallet, film: Film };
export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon; badge?: number };

function isActive(pathname: string, href: string, root: string) {
  return href === root ? pathname === root : pathname.startsWith(href);
}

/** Navegação inferior fixa no celular, lateral no desktop. */
export function NavLinks({ items, root }: { items: NavItem[]; root: string }) {
  const pathname = usePathname();
  // Durante o treino a tela é só do treino (o timer ocupa o rodapé).
  if (/\/(treinar|registrar)(\/|$)/.test(pathname)) return null;
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:pb-0 md:backdrop-blur-none"
    >
      <ul className="mx-auto flex max-w-md justify-around md:max-w-none md:flex-col md:gap-1">
        {items.map(({ href, label, icon, badge }) => {
          const Icon = ICONS[icon];
          const active = isActive(pathname, href, root);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-semibold transition md:flex-row md:gap-3 md:rounded-2xl md:px-4 md:py-3 md:text-sm",
                  active
                    ? "text-bandeira-600 md:bg-bandeira-50 dark:text-bandeira-100 md:dark:bg-bandeira-500/15"
                    : "text-muted hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-6 md:size-5" aria-hidden />
                  {!!badge && (
                    <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-pitanga-500 px-1 text-center text-[10px] leading-4 text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
