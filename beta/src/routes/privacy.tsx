import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | NewsForMe" },
      { name: "description", content: "What NewsForMe stores, why, and how to delete it." },
      { property: "og:title", content: "Privacy | NewsForMe" },
      { property: "og:description", content: "What NewsForMe stores, why, and how to delete it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Privacy,
});

const UPDATED = "October 27, 2026";
const CONTACT = "hello@newsforme.fyi";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 font-serif text-[18px] leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function Privacy() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-sm font-semibold text-link">Privacy</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Your data, in plain words</h1>
      <p className="mt-4 text-muted-foreground">Last updated {UPDATED}.</p>
      <p className="mt-6 font-serif text-[18px] leading-relaxed">
        NewsForMe sends you a short news email each day. To do that, we keep a small amount of
        information about you. This page says what we keep, why, and how to remove it.
      </p>

      <Section title="What we keep">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your email address. We use it to sign you in and send your brief.</li>
          <li>Your name, role, and the note you write about yourself. These help pick and explain stories.</li>
          <li>Your topics, your chosen sources, your send time, and your time zone.</li>
          <li>Whether your emails are on or paused.</li>
          <li>A log of the briefs we sent you: the date, the subject, and whether it was delivered.</li>
          <li>
            The links included in your recent briefs. We use these so you never get the same story
            twice. We delete them after 45 days.
          </li>
        </ul>
        <p>
          We do not ask for your password, phone number, address, or payment details. We do not
          track which links you click.
        </p>
      </Section>

      <Section title="How we use it">
        <p>We use your information only to run NewsForMe. That means:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Signing you in with a code sent to your email.</li>
          <li>Suggesting topics and sources when you set up your brief.</li>
          <li>Searching for news on your topics and writing your daily email.</li>
          <li>Keeping your brief free of repeats.</li>
        </ul>
        <p>We do not sell your information. We do not show ads. We do not share your data for marketing.</p>
      </Section>

      <Section title="Services that help us run NewsForMe">
        <p>A few trusted companies process your data on our behalf. Each only gets what it needs.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Supabase</strong> stores your account and settings, on servers in the United
            States.
          </li>
          <li>
            <strong>n8n</strong> runs the steps that build and send your brief each day.
          </li>
          <li>
            <strong>Perplexity</strong> searches the web for your topics and writes your email. It
            receives your topics, your sources, your role, and your note about yourself. It does
            not receive your email address.
          </li>
          <li>
            <strong>Resend</strong> delivers your emails, including sign-in codes. It receives your
            email address and the email content.
          </li>
          <li>Our website host serves this site. It may keep basic visit logs.</li>
        </ul>
      </Section>

      <Section title="Your choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Stop emails:</strong> use the Unsubscribe link at the bottom of any brief. You
            can also pause in <Link to="/settings" className="text-link underline underline-offset-2">settings</Link>.
          </li>
          <li>
            <strong>Change your details:</strong> edit your profile, topics, sources, or time in
            settings at any time.
          </li>
          <li>
            <strong>Delete everything:</strong> use "Delete my account" at the bottom of{" "}
            <Link to="/settings" className="text-link underline underline-offset-2">settings</Link>. It removes your
            account and all your data from our database right away.
          </li>
          <li>
            <strong>Get a copy:</strong> email us and we will send you the data we hold about you.
          </li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your account until you delete it. Links from past briefs are deleted after 45
          days. If you unsubscribe, we keep your settings so you can turn emails back on. Delete your
          account in settings if you want them gone too.
        </p>
      </Section>

      <Section title="Keeping it safe">
        <p>
          Your data is stored with access controls, so each person can only see their own account.
          Sign-in uses one-time codes, so there is no password to steal. No system is perfect. If
          something goes wrong that affects you, we will tell you.
        </p>
      </Section>

      <Section title="Who can use NewsForMe">
        <p>NewsForMe is not meant for children under 13. We do not knowingly collect their data.</p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If we change this page in a way that matters, we will tell you by email before it takes
          effect. Questions? Write to{" "}
          <a href={`mailto:${CONTACT}`} className="text-link underline underline-offset-2">
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
