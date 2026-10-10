import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/cn";

export function Alert({
  kind = "error",
  children,
  className,
}: {
  kind?: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = kind === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-2xl px-4 py-3 text-sm",
        kind === "error" && "bg-pitanga-100 text-pitanga-600 dark:bg-pitanga-500/15",
        kind === "success" && "bg-bandeira-50 text-bandeira-700 dark:bg-bandeira-500/15 dark:text-bandeira-100",
        kind === "info" && "bg-ipe-100 text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <Alert>{state.error}</Alert>;
  if (state?.ok) return <Alert kind="success">{state.ok}</Alert>;
  return null;
}
