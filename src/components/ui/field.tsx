import { cn } from "@/lib/cn";

export const inputClass =
  "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none transition placeholder:text-muted/70 focus:border-bandeira-500 focus:ring-4 focus:ring-bandeira-500/15";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Field({ label, hint, id, name, className, ...props }: FieldProps) {
  const fieldId = id ?? name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-semibold">
        {label}
      </label>
      <input id={fieldId} name={name} className={cn(inputClass, className)} {...props} />
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
