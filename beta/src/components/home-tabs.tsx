import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { fetchLatestBriefing, type LatestBriefing } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Tab = "news" | "map";

/** Signed-in homepage: today's top stories from the latest brief, plus a locked preview of what's next. */
export function HomeTabs() {
  const [tab, setTab] = useState<Tab>("news");
  const [briefing, setBriefing] = useState<LatestBriefing | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user || cancelled) return;
      const latest = await fetchLatestBriefing(user.id);
      if (cancelled) return;
      setBriefing(latest);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex justify-center gap-2" role="tablist" aria-label="Your news">
        <TabButton active={tab === "news"} onClick={() => setTab("news")}>
          Today's top news
        </TabButton>
        <TabButton active={tab === "map"} onClick={() => setTab("map")}>
          <span className="inline-flex items-center gap-1.5">
            My News Map
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </TabButton>
      </div>

      {tab === "news" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Loading your stories...</p>
          ) : briefing && briefing.stories.length > 0 ? (
            <>
              <div className="text-sm text-muted-foreground">
                From your latest brief{briefing.subject ? `: ${briefing.subject}` : ""}
              </div>
              <div className="mt-5 space-y-5 border-t border-border pt-5">
                {briefing.stories.map((s) => (
                  <article key={s.title}>
                    {s.topic ? (
                      <div className="text-xs font-bold uppercase tracking-wide text-link">{s.topic}</div>
                    ) : null}
                    <h4 className="mt-0.5 text-lg leading-snug">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-link">
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                    </h4>
                    {s.summary ? (
                      <p className="mt-1 font-serif text-[17px] leading-relaxed text-foreground/85">{s.summary}</p>
                    ) : null}
                    {s.why_it_matters ? (
                      <p className="mt-2 font-serif text-[15px] leading-relaxed text-muted-foreground">
                        <span className="font-sans text-xs font-bold uppercase tracking-wide text-link">Why it matters: </span>
                        {s.why_it_matters}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center">
              <h3 className="text-2xl">Your first brief is on its way.</h3>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                Once it lands in your inbox, the stories worth your time will show up here too.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-10 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-2xl">My News Map</h3>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Coming soon. A map of the topics and stories you follow, and how they connect.
          </p>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
