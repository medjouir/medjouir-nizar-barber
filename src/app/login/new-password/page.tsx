import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { getCurrentBarber } from "@/lib/auth";
import { NewPasswordForm } from "./new-password-form";

export default async function NewPasswordPage() {
  // Reached through the recovery link, which signs Nizar in first.
  if (!(await getCurrentBarber())) redirect("/login");

  return (
    <PageShell className="justify-center gap-section">
      <h1 className="text-title font-semibold">Mot de passe jdid</h1>
      <NewPasswordForm />
    </PageShell>
  );
}
