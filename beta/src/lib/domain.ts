export const MAX_TOPICS = 5;
export const MAX_SOURCES = 80;

/** Turn whatever the user typed into a bare lowercase domain, or null if it is not one. */
export function cleanDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split(/[/?#]/)[0] ?? "";
  d = d.split(":")[0] ?? "";
  d = d.replace(/\.$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return null;
  return d;
}

export function formatHour(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

const HOUR_MS = 3_600_000;
export const MIN_DEMO_GAP_HOURS = 20;

function tzDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function wallToUtc(y: number, m: number, d: number, h: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wallAtGuess = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return new Date(guess.getTime() + (guess.getTime() - wallAtGuess));
}

/** When the first real briefing arrives: the next scheduled send, skipped if it is less than 20 hours away. */
export function firstBriefing(sendHour: number, timeZone: string, now = new Date()): { date: Date; day: "tomorrow" | "dayAfter" } {
  const { y, m, d } = tzDateParts(now, timeZone);
  let next = wallToUtc(y, m, d, sendHour, timeZone);
  if (next.getTime() <= now.getTime()) next = new Date(next.getTime() + 24 * HOUR_MS);
  let day: "tomorrow" | "dayAfter" = "tomorrow";
  if (next.getTime() - now.getTime() < MIN_DEMO_GAP_HOURS * HOUR_MS) {
    next = new Date(next.getTime() + 24 * HOUR_MS);
    day = "dayAfter";
  }
  return { date: next, day };
}

export type TopStory = { topic: string; title: string; summary: string; url: string; why_it_matters: string };

export const MAX_TOP_STORIES = 10;

/** Turn the top_stories JSON saved by the email backend into clean stories. Drops entries without a title. */
export function parseTopStories(raw: unknown): TopStory[] {
  if (!Array.isArray(raw)) return [];
  const stories: TopStory[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = String(o["title"] ?? "").trim().slice(0, 200);
    if (!title) continue;
    stories.push({
      topic: String(o["topic"] ?? "").trim().slice(0, 80),
      title,
      summary: String(o["summary"] ?? "").trim().slice(0, 600),
      url: String(o["url"] ?? "").trim().slice(0, 500),
      why_it_matters: String(o["why_it_matters"] ?? "").trim().slice(0, 600),
    });
    if (stories.length >= MAX_TOP_STORIES) break;
  }
  return stories;
}

export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err ?? "");
  const m = msg.toLowerCase();
  if (m.includes("5 topic") || (m.includes("topic") && (m.includes("limit") || m.includes("max"))))
    return "You can have up to 5 topics.";
  if (m.includes("80") || (m.includes("source") && (m.includes("limit") || m.includes("max"))))
    return "You have too many sources. Remove a few and try again.";
  if (m.includes("duplicate") || m.includes("unique")) return "That source is already on the list.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Please wait a minute.";
  if (m.includes("failed to fetch") || m.includes("network")) return "We could not reach the server. Check your connection.";
  if (m.includes("jwt") || m.includes("not authenticated")) return "Your session ended. Please sign in again.";
  return "Something went wrong. Please try again.";
}
