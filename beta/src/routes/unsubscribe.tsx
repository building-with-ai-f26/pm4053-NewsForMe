import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/unsubscribe")({
  ssr: false,
  validateSearch: z.object({ t: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Unsubscribe | NewsForMe" },
      { name: "description", content: "Manage your NewsForMe daily email subscription." },
      { property: "og:title", content: "Unsubscribe | NewsForMe" },
      { property: "og:description", content: "Manage your NewsForMe daily email subscription." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Unsubscribe,
});

type State = "ask" | "off" | "on" | "bad" | "error";

const isToken = (t?: string) => !!t && /^[0-9a-f-]{36}$/i.test(t);

function Unsubscribe() {
  const { t } = Route.useSearch();
  const [state, setState] = useState<State>(isToken(t) ? "ask" : "bad");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(fn: "unsubscribe_by_token" | "resubscribe_by_token", next: State) {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc(fn, { p_token: t });
      if (error) throw error;
      const res = data as { ok: boolean; email_hint?: string } | null;
      if (!res?.ok) return setState("bad");
      setHint(res.email_hint ?? "");
      setState(next);
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      {state === "ask" && (
        <>
          <h1 className="text-4xl font-semibold">Stop your daily brief?</h1>
          <p className="mt-4 text-muted-foreground">
            You will stop getting NewsForMe emails. Your topics and sources stay saved.
          </p>
          <Button className="mt-8" size="lg" disabled={busy} onClick={() => call("unsubscribe_by_token", "off")}>
            {busy ? "One moment..." : "Unsubscribe"}
          </Button>
        </>
      )}

      {state === "off" && (
        <>
          <h1 className="text-4xl font-semibold">You are unsubscribed</h1>
          <p className="mt-4 text-muted-foreground">
            We will stop sending briefs{hint ? ` to ${hint}` : ""}. Your topics and sources are saved.
          </p>
          <Button className="mt-8" variant="outline" disabled={busy} onClick={() => call("resubscribe_by_token", "on")}>
            {busy ? "One moment..." : "Undo, keep sending my brief"}
          </Button>
        </>
      )}

      {state === "on" && (
        <>
          <h1 className="text-4xl font-semibold">Welcome back</h1>
          <p className="mt-4 text-muted-foreground">Your daily brief is on again.</p>
          <Button asChild className="mt-8">
            <Link to="/settings">Change topics or time</Link>
          </Button>
        </>
      )}

      {state === "bad" && (
        <>
          <h1 className="text-3xl font-semibold">This link did not work</h1>
          <p className="mt-4 text-muted-foreground">
            Use the unsubscribe link in your latest email, or sign in to pause emails in settings.
          </p>
          <Button asChild className="mt-8" variant="outline">
            <Link to="/settings" search={{ pause: "1" }}>Go to settings</Link>
          </Button>
        </>
      )}

      {state === "error" && (
        <>
          <h1 className="text-3xl font-semibold">Something went wrong</h1>
          <p className="mt-4 text-muted-foreground">Please try again in a minute.</p>
          <Button className="mt-8" onClick={() => call("unsubscribe_by_token", "off")}>
            Try again
          </Button>
        </>
      )}
    </div>
  );
}
