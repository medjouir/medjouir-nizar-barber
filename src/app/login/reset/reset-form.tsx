"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { requestPasswordReset, type FormState } from "../actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Email" name="email" type="email" inputMode="email" autoComplete="email" required />
      <FormMessage message={state.error} />
      <FormMessage message={state.info} tone="info" />
      {/* Proposed copy — pending review. */}
      <Button type="submit" loading={pending} disabled={Boolean(state.info)} className="mt-2">
        Sift lien
      </Button>
    </form>
  );
}
