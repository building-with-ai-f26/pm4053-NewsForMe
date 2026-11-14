import { createFileRoute } from "@tanstack/react-router";
import { MagicLinkForm } from "@/components/magic-link-form";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | NewsForMe" },
      { name: "description", content: "Sign in to NewsForMe with a link sent to your email." },
      { property: "og:title", content: "Sign in | NewsForMe" },
      { property: "og:description", content: "Sign in to NewsForMe with a link sent to your email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-4xl font-semibold">Sign in</h1>
      <p className="mt-3 text-muted-foreground">
        No password needed. We will email you a code to sign in.
      </p>
      <div className="mt-8">
        <MagicLinkForm cta="Send code" />
      </div>
    </div>
  );
}
