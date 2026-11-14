import { redirect } from "@tanstack/react-router";
import { supabase } from "./supabase";

/** Client-only guard: send signed-out visitors to /login. */
export async function requireUser() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/login" });
  return { user: data.session.user };
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + "/auth/callback" },
  });
  if (error) throw error;
}
