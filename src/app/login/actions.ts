"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; info?: string };

// Proposed Darija copy (not in the approved spec) — pending review.
const COPY = {
  invalid: "Email wla mot de passe machi s7i7.",
  failed: "Ma9dernach ndekhlok. 3awed jereb.",
  resetSent: "Ila kan had email 3endna, ghadi iwslek lien. Chof email dyalk.",
  passwordTooShort: "Mot de passe khasso ikoun fih 8 7rouf 3la l9al.",
  passwordFailed: "Ma9dernach nbdlo mot de passe. 3awed jereb.",
} as const;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!email || typeof password !== "string" || !password) return { error: COPY.invalid };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.status === 400 ? COPY.invalid : COPY.failed };

  // Only the owner of a barber account may enter; anyone else is signed out
  // with the same generic message so account existence is not revealed.
  // Read through RLS with the freshly signed-in client.
  const { data: barber } = await supabase.from("barbers").select("id").eq("user_id", data.user.id).maybeSingle();
  if (!barber) {
    await supabase.auth.signOut();
    return { error: COPY.invalid };
  }

  redirect("/dashboard");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email").toLowerCase();
  if (!email) return { error: COPY.invalid };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/login/new-password`,
  });

  // Same answer whether or not the email exists.
  return { info: COPY.resetSent };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) return { error: COPY.passwordTooShort };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: COPY.passwordFailed };

  redirect("/dashboard");
}
