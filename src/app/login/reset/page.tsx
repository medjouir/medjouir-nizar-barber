import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { ResetForm } from "./reset-form";

export default function ResetPage() {
  return (
    <PageShell className="justify-center gap-section">
      <h1 className="text-title font-semibold">Nsiti mot de passe?</h1>
      <ResetForm />
      <Link href="/login" className="mx-auto py-3 text-secondary text-muted hover:text-fg">
        Dkhol
      </Link>
    </PageShell>
  );
}
