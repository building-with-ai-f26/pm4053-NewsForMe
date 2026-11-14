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
