import { cn } from "@/lib/cn";

/** Inline form feedback, announced to screen readers. */
export function FormMessage({ message, tone = "error" }: { message?: string; tone?: "error" | "info" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("text-secondary", tone === "error" ? "text-danger" : "text-muted")}
    >
      {message}
    </p>
  );
}
