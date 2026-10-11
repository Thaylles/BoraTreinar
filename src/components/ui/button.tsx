import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ipe";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-bandeira-500 text-white shadow-md shadow-bandeira-500/20 hover:bg-bandeira-600 disabled:bg-bandeira-500/60",
  secondary:
    "border-2 border-anil-700 text-anil-700 hover:bg-anil-700 hover:text-white dark:border-ipe-500 dark:text-ipe-500 dark:hover:bg-ipe-500 dark:hover:text-anil-900",
  ghost: "text-foreground hover:bg-ipe-100 dark:hover:bg-surface",
  danger: "bg-pitanga-500 text-white hover:bg-pitanga-600",
  ipe: "bg-ipe-500 text-anil-900 hover:bg-ipe-400",
};
const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-xl",
  md: "px-4 py-2.5 rounded-2xl",
  lg: "px-6 py-4 text-lg rounded-2xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-display font-bold transition disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

type LinkButtonProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
