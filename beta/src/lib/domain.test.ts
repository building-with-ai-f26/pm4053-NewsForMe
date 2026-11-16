import { describe, expect, it } from "vitest";
import { cleanDomain, firstBriefing, formatHour } from "./domain";

describe("cleanDomain", () => {
  it("strips protocol, www and path, and lowercases", () => {
    expect(cleanDomain("https://www.Reuters.com/world/us")).toBe("reuters.com");
  });
  it("keeps subdomains other than www", () => {
    expect(cleanDomain("news.ycombinator.com")).toBe("news.ycombinator.com");
  });
  it("rejects things that are not domains", () => {
    expect(cleanDomain("reuters")).toBeNull();
    expect(cleanDomain("hello world.com")).toBeNull();
  });
});

describe("formatHour", () => {
  it("shows 12-hour times", () => {
    expect(formatHour(0)).toBe("12:00 AM");
    expect(formatHour(8)).toBe("8:00 AM");
    expect(formatHour(12)).toBe("12:00 PM");
    expect(formatHour(19)).toBe("7:00 PM");
  });
});

describe("firstBriefing", () => {
  it("skips today's send when it is only 2 hours away and delivers the day after", () => {
    const now = new Date("2026-01-10T06:00:00Z");
    const r = firstBriefing(8, "UTC", now);
    expect(r.day).toBe("dayAfter");
    expect(r.date.toISOString()).toBe("2026-01-11T08:00:00.000Z");
  });
  it("delivers tomorrow when the next send is 22 hours away", () => {
    const now = new Date("2026-01-10T10:00:00Z");
    const r = firstBriefing(8, "UTC", now);
    expect(r.day).toBe("tomorrow");
    expect(r.date.toISOString()).toBe("2026-01-11T08:00:00.000Z");
  });
  it("pushes to the day after when the next send is less than 20 hours away", () => {
    const now = new Date("2026-01-10T13:00:00Z");
    const r = firstBriefing(8, "UTC", now);
    expect(r.day).toBe("dayAfter");
    expect(r.date.toISOString()).toBe("2026-01-12T08:00:00.000Z");
  });
});
