import { describe, expect, it } from "vitest";
import { cleanDomain, formatHour } from "./domain";

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
