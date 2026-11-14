import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CheckCircle2, Plus, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonaForm } from "@/components/persona-form";
import { buildAbout, buildRole, emptyAnswers, missingFields, parseAbout, type Answers } from "@/lib/persona";
import { Progress } from "@/components/ui/progress";
import {
  HourSelect,
  LoadingNote,
  SourceChips,
  SuggestionCard,
  TimezonePicker,
} from "@/components/editors";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  fetchSuggestions,
  newKey,
  replaceTopicsAndSources,
  sendDemo,
  type DraftTopic,
  type Suggestion,
} from "@/lib/api";
import { MAX_TOPICS, formatHour, friendlyError } from "@/lib/domain";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: requireUser,
  head: () => ({
    meta: [
      { title: "Set up your brief | NewsForMe" },
      { name: "description", content: "Tell us what you care about and when to send your news." },
      { property: "og:title", content: "Set up your brief | NewsForMe" },
      { property: "og:description", content: "Tell us what you care about and when to send your news." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["About you", "Topics", "Sources", "Delivery"];

function Onboarding() {
  const { user } = Route.useRouteContext();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const role = buildRole(answers);
  const about = buildAbout(answers);
  const [topics, setTopics] = useState<DraftTopic[]>([]);
  const [globalSources, setGlobalSources] = useState<string[]>([]);
  const [hour, setHour] = useState(8);
  const [tz, setTz] = useState("America/New_York");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | { demo: boolean }>(null);

  // suggestion state
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugError, setSugError] = useState(false);
  const sugFor = useRef("");

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York");
    supabase
      .from("profiles")
      .select("full_name, role, about")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName((v) => v || data.full_name || "");
          const parsed = parseAbout(data.about);
          if (parsed) setAnswers((v) => (v.persona ? v : parsed));
        }
      });
  }, [user.id]);

  async function loadSuggestions() {
    setSugLoading(true);
    setSugError(false);
    try {
      const list = await fetchSuggestions({ mode: "suggest", about, role });
      setSuggestions(list);
      sugFor.current = about + "|" + role;
    } catch {
      setSugError(true);
    } finally {
      setSugLoading(false);
    }
  }

  useEffect(() => {
    if (step === 1 && sugFor.current !== about + "|" + role && !sugLoading) loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Sources step: prefill custom topics
  const [srcLoading, setSrcLoading] = useState(false);
  const [srcError, setSrcError] = useState(false);
  async function prefillCustomSources() {
    const need = topics.filter((t) => t.custom && t.sources.length === 0);
    if (!need.length) return;
    setSrcLoading(true);
    setSrcError(false);
    try {
      const list = await fetchSuggestions({ mode: "sources", about, role, topics: need.map((t) => t.name) });
      setTopics((prev) =>
        prev.map((t) => {
          if (!t.custom || t.sources.length) return t;
          const hit = list.find((s) => s.name.toLowerCase() === t.name.toLowerCase());
          return hit ? { ...t, sources: hit.sources, description: t.description || hit.description } : t;
        }),
      );
    } catch {
      setSrcError(true);
    } finally {
      setSrcLoading(false);
    }
  }
  useEffect(() => {
    if (step === 2) prefillCustomSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function canNext() {
    if (step === 0) return missingFields(answers).length === 0;
    if (step === 1) return topics.length >= 1 && topics.length <= MAX_TOPICS;
    return true;
  }

  async function finish() {
    setSaving(true);
    try {
      const p = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim().slice(0, 100) || null,
          role: role || null,
          about,
          timezone: tz,
          send_hour: hour,
          is_active: true,
        })
        .eq("id", user.id);
      if (p.error) throw p.error;
      await replaceTopicsAndSources(user.id, topics, globalSources);
      const c = await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", user.id);
      if (c.error) throw c.error;
      const demo = await sendDemo();
      setDone({ demo });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 text-4xl font-semibold">You are all set</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {done.demo
            ? "Your first brief is on its way. Check your inbox in about 2 minutes."
            : `Your first brief will arrive at ${formatHour(hour)} your time.`}
        </p>
        <Button asChild className="mt-8" size="lg">
          <Link to="/settings">Go to settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-2 flex justify-between text-sm text-muted-foreground">
        <span>
          Step {step + 1} of {STEPS.length}
        </span>
        <span>{STEPS[step]}</span>
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />

      <div className="mt-8">
        {step === 0 && (
          <section className="space-y-5">
            <h1 className="text-4xl font-semibold">About you</h1>
            <p className="text-muted-foreground">This helps us pick news that fits your life.</p>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <PersonaForm value={answers} onChange={setAnswers} />
            {answers.persona && missingFields(answers).length > 0 && (
              <p className="text-sm text-muted-foreground">Still needed: {missingFields(answers).join(", ")}.</p>
            )}
          </section>
        )}

        {step === 1 && (
          <TopicsStep
            topics={topics}
            setTopics={setTopics}
            suggestions={suggestions}
            loading={sugLoading}
            error={sugError}
            retry={loadSuggestions}
          />
        )}

        {step === 2 && (
          <section className="space-y-6">
            <h1 className="text-4xl font-semibold">Sources</h1>
            <p className="text-muted-foreground">
              Pick the sites you trust for each topic. Reuters and AP are always included.
            </p>
            {srcLoading && <LoadingNote text="Finding good sources for your own topics. This can take up to 30 seconds." />}
            {srcError && (
              <div className="flex items-center justify-between rounded-lg border border-destructive/40 p-4 text-sm">
                We could not suggest sources. You can add them yourself.
                <Button size="sm" variant="outline" onClick={prefillCustomSources}>
                  <RotateCw className="h-4 w-4" /> Retry
                </Button>
              </div>
            )}
            {topics.map((t) => (
              <div key={t.key} className="rounded-lg border border-border bg-card p-5">
                <h3 className="mb-3 text-xl font-semibold">{t.name}</h3>
                <SourceChips
                  sources={t.sources}
                  onChange={(s) => setTopics((p) => p.map((x) => (x.key === t.key ? { ...x, sources: s } : x)))}
                />
              </div>
            ))}
            <div className="rounded-lg border border-dashed border-border p-5">
              <h3 className="text-xl font-semibold">Sources for all topics</h3>
              <p className="mb-3 text-sm text-muted-foreground">We will check these for every topic.</p>
              <SourceChips sources={globalSources} onChange={setGlobalSources} />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <h1 className="text-4xl font-semibold">Delivery</h1>
            <p className="text-muted-foreground">When should your brief arrive?</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Time</Label>
                <HourSelect value={hour} onChange={setHour} />
              </div>
              <div className="space-y-2">
                <Label>Time zone</Label>
                <TimezonePicker value={tz} onChange={setTz} />
              </div>
            </div>
            <div className="space-y-3 border-t border-border pt-5 text-sm">
              <h3 className="text-xl font-semibold">Your brief</h3>
              <p>
                <strong>{fullName || "You"}</strong>
                {role && `, ${role}`}
              </p>
              <ul className="space-y-1">
                {topics.map((t) => (
                  <li key={t.key}>
                    <strong>{t.name}</strong>
                    <span className="text-muted-foreground">
                      {" "}
                      from {t.sources.length ? t.sources.join(", ") : "Reuters and AP"}
                    </span>
                  </li>
                ))}
              </ul>
              {globalSources.length > 0 && (
                <p className="text-muted-foreground">Also for every topic: {globalSources.join(", ")}</p>
              )}
              <p>
                Every day at <strong>{formatHour(hour)}</strong>, {tz.replace(/_/g, " ")}.
              </p>
            </div>
          </section>
        )}
      </div>

      <div className="mt-10 flex justify-between gap-3">
        <Button variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < 3 ? (
          <Button size="lg" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button size="lg" disabled={saving} onClick={finish}>
            {saving ? "Saving..." : "Start my briefings"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function TopicsStep({
  topics,
  setTopics,
  suggestions,
  loading,
  error,
  retry,
}: {
  topics: DraftTopic[];
  setTopics: Dispatch<SetStateAction<DraftTopic[]>>;
  suggestions: Suggestion[] | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const [custom, setCustom] = useState("");
  const full = topics.length >= MAX_TOPICS;
  const isChosen = (n: string) => topics.some((t) => t.name.toLowerCase() === n.toLowerCase());

  function toggle(s: Suggestion) {
    if (isChosen(s.name)) { setTopics((p) => p.filter((t) => t.name.toLowerCase() !== s.name.toLowerCase())); return; }
    if (full) { toast.error("You can choose up to 5 topics."); return; }
    setTopics((p) => [...p, { key: newKey(), name: s.name, description: s.description, sources: s.sources }]);
  }
  function addCustom() {
    const n = custom.trim();
    if (!n) return;
    if (n.length > 80) { toast.error("Keep topic names under 80 characters."); return; }
    if (full) { toast.error("You can choose up to 5 topics."); return; }
    if (isChosen(n)) { toast.error("You already have that topic."); return; }
    setTopics((p) => [...p, { key: newKey(), name: n, description: "", sources: [], custom: true }]);
    setCustom("");
  }

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-4xl font-semibold">Topics</h1>
        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-link">
          {topics.length} of {MAX_TOPICS} chosen
        </span>
      </div>
      <p className="text-muted-foreground">Pick what you want to read about. Choose up to 5.</p>

      {loading && <LoadingNote text="Reading about you and picking topics. This takes 10 to 30 seconds." />}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          We could not load ideas. You can still type your own topics below.
          <Button size="sm" variant="outline" onClick={retry}>
            <RotateCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.name}
              name={s.name}
              description={s.description}
              selected={isChosen(s.name)}
              disabled={full}
              onToggle={() => toggle(s)}
            />
          ))}
        </div>
      )}
      {suggestions && suggestions.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">No ideas this time. Add your own below.</p>
      )}

      <div className="space-y-2 pt-2">
        <Label htmlFor="custom">Add your own topic</Label>
        <div className="flex gap-2">
          <Input
            id="custom"
            maxLength={80}
            value={custom}
            disabled={full}
            placeholder={full ? "You have 5 topics" : "For example: Climate tech"}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <Button type="button" variant="outline" disabled={full} onClick={addCustom}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {topics.some((t) => t.custom) && (
        <div className="flex flex-wrap gap-2">
          {topics
            .filter((t) => t.custom)
            .map((t) => (
              <span key={t.key} className="inline-flex items-center gap-1 rounded-full border border-foreground bg-foreground px-3 py-1 text-sm font-semibold text-background">
                {t.name}
                <button
                  aria-label={`Remove ${t.name}`}
                  onClick={() => setTopics((p) => p.filter((x) => x.key !== t.key))}
                  className="text-background/70 hover:text-background"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
