import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Signing you in | NewsForMe" },
    { name: "description", content: "Complete your NewsForMe email sign-in." },
    { property: "og:title", content: "Signing you in | NewsForMe" },
    { property: "og:description", content: "Complete your NewsForMe email sign-in." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;
    async function finish() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code).catch(() => null);
      const hashErr = new URLSearchParams(url.hash.slice(1)).get("error_description");
      if (hashErr || url.searchParams.get("error")) return setFailed(true);

      let session = (await supabase.auth.getSession()).data.session;
      for (let i = 0; !session && i < 10; i++) {
        await new Promise((r) => setTimeout(r, 300));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (done) return;
      if (!session) return setFailed(true);
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", session.user.id)
        .maybeSingle();
      navigate({ to: data?.onboarding_complete ? "/settings" : "/onboarding", replace: true });
    }
    finish();
    return () => {
      done = true;
    };
  }, [navigate]);

  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      {failed ? (
        <>
          <h1 className="text-3xl font-semibold">That link did not work</h1>
          <p className="mt-3 text-muted-foreground">It may have expired. Ask for a new one.</p>
          <Button className="mt-6" onClick={() => navigate({ to: "/login" })}>
            Get a new link
          </Button>
        </>
      ) : (
        <>
          <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Signing you in...</p>
        </>
      )}
    </div>
  );
}
