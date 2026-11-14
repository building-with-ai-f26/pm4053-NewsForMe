import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink } from "@/lib/auth";
import { friendlyError } from "@/lib/domain";
import { supabase } from "@/lib/supabase";

export function MagicLinkForm({ cta = "Send my code" }: { cta?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(addr: string) {
    setSending(true);
    try {
      await sendMagicLink(addr);
      setSentTo(addr);
      setCooldown(60);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSending(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      toast.error("Please enter the code from your email.");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: sentTo, token, type: "email" });
      if (error || !data.session) throw error ?? new Error("no session");
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", data.session.user.id)
        .maybeSingle();
      navigate({ to: profile?.onboarding_complete ? "/settings" : "/onboarding", replace: true });
    } catch {
      toast.error("That code did not work. Check it, or ask for a new one.");
    } finally {
      setVerifying(false);
    }
  }

  if (sentTo) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Mail className="h-5 w-5 text-link" /> Check your inbox
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a sign in code to <strong className="text-foreground">{sentTo}</strong>. Type it
          below.
        </p>
        <form onSubmit={verify} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={10}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-11 bg-background text-center text-lg tracking-[0.3em]"
            aria-label="Sign in code"
          />
          <Button type="submit" size="lg" className="h-11" disabled={verifying}>
            {verifying ? "Checking..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={cooldown > 0 || sending} onClick={() => send(sentTo)}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? "Sending..." : "Send a new code"}
          </Button>
          <Button variant="ghost" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) { toast.error("Please enter a valid email."); return; }
        send(email.trim());
      }}
    >
      <Input
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 bg-card"
        aria-label="Email address"
      />
      <Button type="submit" size="lg" className="h-11" disabled={sending}>
        {sending ? "Sending..." : cta}
      </Button>
    </form>
  );
}
