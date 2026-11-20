import { createFileRoute } from "@tanstack/react-router";
import { HomeTabs } from "@/components/home-tabs";
import { MagicLinkForm } from "@/components/magic-link-form";
import { LogoMark, useSignedIn } from "@/components/site-chrome";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NewsForMe: your daily news brief" },
      { name: "description", content: "Your news. Picked for you. In your inbox every morning." },
      { property: "og:title", content: "NewsForMe: your daily news brief" },
      { property: "og:description", content: "Your news. Picked for you. In your inbox every morning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { n: "1", t: "Tell us about you", d: "A few quick questions about your studies, work or research." },
  { n: "2", t: "Pick up to 5 topics", d: "We suggest some. You can add your own." },
  { n: "3", t: "Choose sources and time", d: "Pick the sites you trust and when the email lands." },
];

const faqs = [
  { q: "Is it free?", a: "Yes. NewsForMe is free to use." },
  { q: "How do I stop it?", a: "Every email has a one-click unsubscribe link at the bottom. You can also pause in your profile." },
  {
    q: "Where does the news come from?",
    a: "From the sources you choose, plus Reuters and AP. We read the latest stories and write a short summary for you.",
  },
];

function Landing() {
  const signedIn = useSignedIn();
  return (
    <div className="mx-auto max-w-5xl px-5">
      <section className="flex flex-col gap-14 py-14 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <LogoMark className="h-16 w-16 text-3xl rounded-xl" />
          <h1 className="mt-6 text-4xl leading-[1.1] sm:text-5xl md:text-6xl">
            Your news. Picked for you. In your inbox every morning.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg text-muted-foreground">
            One short email a day. Only the stories that matter to you. Set it up in two minutes.
          </p>
          {signedIn ? null : (
            <div className="mx-auto mt-8 max-w-md text-left">
              <MagicLinkForm cta="Get started" />
              <p className="mt-2 text-center text-xs text-muted-foreground">We will email you a code. No password.</p>
            </div>
          )}
        </div>
        {signedIn ? (
          <HomeTabs />
        ) : (
          <div className="mx-auto w-full max-w-xl">
            <SampleEmail />
          </div>
        )}
      </section>

      <section className="border-t border-border py-14">
        <h2 className="text-3xl">How it works</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {s.n}
              </div>
              <h3 className="mt-4 text-xl">{s.t}</h3>
              <p className="mt-1 text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-14">
        <h2 className="text-3xl">Questions</h2>
        <Accordion type="single" collapsible className="mt-4 max-w-2xl">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-base font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {signedIn ? null : (
        <section className="border-t border-border py-16 text-center">
          <h2 className="text-3xl md:text-4xl">Ready for a calmer morning?</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Enter your email and we will send you a sign-in link. No password needed.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <MagicLinkForm cta="Get started" />
          </div>
        </section>
      )}
    </div>
  );
}

function SampleEmail() {
  const three = [
    { h: "New rules for AI models get a vote next week", p: "Lawmakers set out what companies must disclose. Startups get more time.", w: "If you build AI products, disclosure work could land on your roadmap this year.", src: "Reuters" },
    { h: "Card fees face a fresh challenge", p: "Merchants filed a new case over swipe fees.", w: "A ruling could reshape how fintechs price payments.", src: "AP" },
    { h: "Early stage deals pick up again", p: "Seed rounds grew for a third month. Most went to AI tools.", w: "Hiring at young startups usually follows funding by a quarter.", src: "TechCrunch" },
  ];
  type Item = { h: string; p: string; w: string; src: string };
  const topics: { t: string; items: Item[] }[] = [
    {
      t: "Enterprise AI ROI",
      items: [
        { h: "Survey: 1 in 4 AI pilots now pay for themselves", p: "Big companies report the clearest savings in support and finance teams.", w: "Budget owners will ask for payback numbers before approving new AI spend.", src: "Wall Street Journal" },
        { h: "Bank cuts AI costs by switching to smaller models", p: "Moving routine tasks to cheaper models halved its monthly bill.", w: "Model choice is becoming a cost lever, not just a quality one.", src: "Bloomberg" },
      ],
    },
    {
      t: "Agentic Commerce",
      items: [
        { h: "Card networks test payments made by AI agents", p: "Shoppers can let an assistant buy within set limits and stores.", w: "Checkout may move from websites into chat assistants.", src: "Reuters" },
      ],
    },
    {
      t: "Visa Immigration Updates",
      items: [
        { h: "Work visa lottery results go out next month", p: "Officials confirmed the timeline and a new online status page.", w: "Applicants and employers should plan start dates around the release.", src: "AP" },
      ],
    },
  ];
  const Why = ({ children }: { children: string }) => (
    <div className="mt-2 rounded-r border-l-[3px] border-primary bg-muted px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-link">Why it matters</div>
      <p className="text-sm text-foreground/85">{children}</p>
    </div>
  );
  const Label = ({ children }: { children: string }) => (
    <h3 className="mb-4 border-b-2 border-primary pb-1 text-[13px] font-extrabold uppercase tracking-wider text-link">{children}</h3>
  );
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-left font-sans shadow-card sm:p-8">
      <div className="flex items-center justify-between border-b-2 border-foreground pb-3">
        <span className="text-lg font-black uppercase tracking-wider">NewsForMe</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tuesday, Nov 24</span>
      </div>
      <div className="mt-6">
        <Label>Three Things</Label>
        <div className="space-y-5">
          {three.map((s, n) => (
            <article key={s.h}>
              <div className="font-bold leading-snug">{n + 1}. <span className="underline decoration-primary underline-offset-2">{s.h}</span></div>
              <p className="mt-1 text-[15px] text-foreground/80">{s.p}</p>
              <Why>{s.w}</Why>
              <div className="mt-1 text-xs text-muted-foreground">{s.src} · <span className="text-link">Read source →</span></div>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-8">
        <Label>Your Topics</Label>
        {topics.map((t) => (
          <div key={t.t} className="mb-4">
            <div className="border-b border-border pb-1 font-bold">{t.t}</div>
            {t.items.length ? (
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {t.items.map((i) => (
                  <li key={i.h}>
                    <span className="font-semibold underline decoration-primary underline-offset-2">{i.h}</span>
                    <p className="text-[15px] text-foreground/80">{i.p}</p>
                    <Why>{i.w}</Why>
                    <div className="mt-1 text-xs text-muted-foreground">{i.src}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm italic text-muted-foreground">No update today.</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Label>Worth Reading</Label>
        <div className="rounded border border-border p-3">
          <div className="font-semibold">State of AI Report 2026</div>
          <div className="text-xs text-muted-foreground">Air Street Capital · Nov 2026</div>
          <p className="mt-1 text-sm text-foreground/80"><span className="font-semibold">Why read it:</span> the clearest yearly snapshot of where AI money and talent are moving.</p>
        </div>
      </div>
      <div className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        newsforme.fyi · <span className="font-semibold text-link">Change topics &amp; delivery</span> · <span className="underline">Unsubscribe</span>
      </div>
    </div>
  );
}
