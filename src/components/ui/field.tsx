import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
};

/** Labelled 56px input. Pass `type`, `inputMode` and `autoComplete` for the right mobile keyboard. */
export function Field({ label, hint, id, name, className, ...props }: FieldProps) {
  const inputId = id ?? name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between text-secondary text-muted">
        {label}
        {hint}
      </span>
      <input
        id={inputId}
        name={name}
        className={cn(
          "h-control w-full rounded-card border border-line bg-surface px-4 text-body text-fg",
          "placeholder:text-subtle transition-colors duration-200 ease-smooth",
          "focus:border-gold focus:outline-none",
          className,
        )}
        {...props}
      />
    </label>
  );
}
