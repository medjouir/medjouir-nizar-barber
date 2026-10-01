import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "text" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-gold text-canvas font-semibold active:bg-gold-pressed disabled:bg-surface disabled:text-subtle",
  secondary:
    "bg-surface text-fg font-medium border border-line active:bg-surface-raised disabled:text-subtle",
  text: "bg-transparent text-muted font-medium active:text-fg disabled:text-subtle",
  danger:
    "bg-transparent text-danger font-medium border border-line active:bg-surface disabled:text-subtle",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Shows a spinner and blocks repeat submissions. */
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-control w-full select-none items-center justify-center gap-2 rounded-card px-5 text-body",
        "transition-colors duration-200 ease-smooth disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
