"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { updatePassword, type FormState } from "../actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {/* Proposed copy — pending review. */}
      <Field
        label="Mot de passe jdid"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormMessage message={state.error} />
      <Button type="submit" loading={pending} className="mt-2">
        7fed
      </Button>
    </form>
  );
}
