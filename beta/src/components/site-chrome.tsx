import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}

export function LogoMark({ className = "h-8 w-8 text-lg" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-primary font-extrabold text-primary-foreground",
        className,
      )}
    >
      N
    </span>
  );
}

export function SiteHeader() {
  const signedIn = useSignedIn();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
          <LogoMark />
          NewsForMe
        </Link>
        {signedIn === null ? null : signedIn ? (
          <Link to="/settings" className="text-sm font-semibold text-foreground hover:text-link">
            Settings
          <Link to="/settings" className="text-sm font-medium text-foreground hover:text-primary">
            Profile
          </Link>
        ) : (
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-foreground hover:text-link">
              Sign in
            </Link>
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
            >
              Get started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <LogoMark className="h-6 w-6 text-sm" />
          NewsForMe
        </span>
        <div className="flex gap-5">
          <Link to="/privacy" className="hover:text-link">
            Privacy
          </Link>
          <a href="mailto:hello@newsforme.fyi" className="hover:text-link">
            hello@newsforme.fyi
          </a>
        </div>
      </div>
    </footer>
  );
}
