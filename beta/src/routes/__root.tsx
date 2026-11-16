import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { PostHogProvider, usePostHog } from "@posthog/react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { supabase } from "@/lib/supabase";

const posthogToken = import.meta.env["VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"];
const posthogHost = import.meta.env["VITE_PUBLIC_POSTHOG_HOST"];
const posthogConfig =
  posthogToken && posthogHost ? { token: posthogToken, host: posthogHost } : null;

if (import.meta.env.DEV && typeof window !== "undefined") {
  if (!posthogToken) {
    console.error(
      new Error(
        "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      ),
    );
  }
  if (!posthogHost) {
    console.error(
      new Error(
        "VITE_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_HOST is configured",
      ),
    );
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const posthog = usePostHog();
  useEffect(() => {
    posthog.captureException(error, {
      boundary: "tanstack_root_error_component",
    });
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, posthog]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">This page did not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NewsForMe: your daily news brief" },
      { name: "description", content: "A personal news email, picked for you, every morning." },
      { property: "og:title", content: "NewsForMe: your daily news brief" },
      { property: "og:description", content: "A personal news email, picked for you, every morning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const app = posthogConfig ? (
    <PostHogProvider
      apiKey={posthogConfig.token}
      options={{
        api_host: posthogConfig.host,
        defaults: "2026-08-30",
        capture_exceptions: true,
        debug: import.meta.env.DEV,
        logs: {
          serviceName: "newsforme-web",
          environment: import.meta.env.PROD ? "production" : "development",
        },
      }}
    >
      {children}
    </PostHogProvider>
  ) : (
    children
  );

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {app}
        <Scripts />
      </body>
    </html>
  );
}

function PostHogIdentity() {
  const posthog = usePostHog();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        identifiedUserId.current = null;
        posthog.reset();
        return;
      }

      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
        const { user } = session;
        if (identifiedUserId.current === user.id) return;

        if (identifiedUserId.current) posthog.reset();
        identifiedUserId.current = user.id;

        const fullName = user.user_metadata["full_name"];
        posthog.identify(user.id, {
          email: user.email,
          ...(typeof fullName === "string" ? { name: fullName } : {}),
        });
      }
    });

    return () => data.subscription.unsubscribe();
  }, [posthog]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const app = (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );

  return posthogConfig ? (
    <>
      <PostHogIdentity />
      {app}
    </>
  ) : (
    app
  );
}
