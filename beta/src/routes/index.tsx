import { createFileRoute } from "@tanstack/react-router";
import { MagicLinkForm } from "@/components/magic-link-form";
import { LogoMark } from "@/components/site-chrome";
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
  { q: "How do I stop it?", a: "Every email has a one-click unsubscribe link at the bottom. You can also pause in settings." },
  {
    q: "Where does the news come from?",
    a: "From the sources you choose, plus Reuters and AP. We read the latest stories and write a short summary for you.",
  },
];

function Landing() {
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
          <div className="mx-auto mt-8 max-w-md text-left">
            <MagicLinkForm cta="Get started" />
            <p className="mt-2 text-center text-xs text-muted-foreground">We will email you a code. No password.</p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-xl">
          <SampleEmail />
        </div>
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

      <section className="border-t border-border py-16 text-center">
        <h2 className="text-3xl md:text-4xl">Ready for a calmer morning?</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Enter your email and we will send you a sign-in link. No password needed.
        </p>
        <div className="mx-auto mt-6 max-w-md">
          <MagicLinkForm cta="Get started" />
        </div>
      </section>
    </div>
  );
}

function SampleEmail() {
  const items = [
    { tag: "AI", h: "New rules for AI models get a vote next week", p: "Lawmakers set out what companies must disclose. Startups get more time." },
    { tag: "Fintech", h: "Card fees face a fresh challenge", p: "Merchants filed a new case. A ruling could change what you pay." },
    { tag: "Funding", h: "Early stage deals pick up again", p: "Seed rounds grew for a third month. Most went to AI tools." },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
      <div className="flex items-center gap-3">
        <LogoMark className="h-10 w-10 text-lg" />
        <div className="min-w-0 text-sm">
          <div className="font-semibold text-foreground">NewsForMe</div>
          <div className="text-muted-foreground">Tuesday, 7:00 AM · 3 min read</div>
        </div>
      </div>
      <div className="mt-5 text-2xl font-bold tracking-tight">Your Morning Brief</div>
      <div className="mt-1 text-muted-foreground">Three stories for Maya today.</div>
      <div className="mt-5 space-y-5 border-t border-border pt-5">
        {items.map((i) => (
          <article key={i.h}>
            <div className="text-xs font-bold uppercase tracking-wide text-link">{i.tag}</div>
            <h4 className="mt-0.5 text-lg leading-snug">{i.h}</h4>
            <p className="mt-1 font-serif text-[17px] leading-relaxed text-foreground/85">{i.p}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
