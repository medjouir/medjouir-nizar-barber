import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

/** Labelled 56px input. Pass `type`, `inputMode` and `autoComplete` for the right mobile keyboard. */
export function Field({ label, hint, error, id, name, className, ...props }: FieldProps) {
  const inputId = id ?? name;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="flex items-baseline justify-between text-secondary text-muted">
        {label}
        {hint}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          "h-control w-full rounded-card border bg-surface px-4 text-body text-fg",
          "placeholder:text-subtle transition-colors duration-200 ease-smooth focus:outline-none",
          error ? "border-danger" : "border-line focus:border-gold",
          className,
        )}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-secondary text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
