import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { PageShell } from "@/components/ui/page-shell";
import { getCurrentBarber } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Dkhol — Nizar" };

export default async function LoginPage() {
  if (await getCurrentBarber()) redirect("/dashboard");

  return (
    <PageShell className="justify-center gap-section">
      <BrandMark />
      <h1 className="text-title font-semibold">Dkhol l espace dyalk</h1>
      <LoginForm />
    </PageShell>
  );
}
