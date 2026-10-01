"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { signIn, type FormState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Email" name="email" type="email" inputMode="email" autoComplete="email" required />
      <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      <FormMessage message={state.error} />
      <Button type="submit" loading={pending} className="mt-2">
        Dkhol
      </Button>
      <Link
        href="/login/reset"
        className="mx-auto py-3 text-secondary text-muted transition-colors duration-200 hover:text-fg"
      >
        Nsiti mot de passe?
      </Link>
    </form>
  );
}
