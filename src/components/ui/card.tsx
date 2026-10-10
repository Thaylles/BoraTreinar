import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-3xl border border-border bg-surface p-5 shadow-sm", className)}
      {...props}
    />
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-3xl font-extrabold leading-tight">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "yellow" | "red" | "blue";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-border/60 text-muted",
        tone === "green" && "bg-bandeira-50 text-bandeira-700 dark:bg-bandeira-500/15 dark:text-bandeira-100",
        tone === "yellow" && "bg-ipe-100 text-anil-900 dark:bg-ipe-500/20 dark:text-ipe-400",
        tone === "red" && "bg-pitanga-100 text-pitanga-600 dark:bg-pitanga-500/15",
        tone === "blue" && "bg-anil-700/10 text-anil-700 dark:bg-anil-500/30 dark:text-white",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border px-6 py-10 text-center">
      <div className="text-bandeira-500">{icon}</div>
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}
