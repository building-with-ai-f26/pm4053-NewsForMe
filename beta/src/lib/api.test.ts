import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAllSettings } from "./api";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(), update: vi.fn(), from: vi.fn(), rpc: vi.fn(),
}));
vi.mock("./supabase", () => ({
  DEMO_URL: "", SUGGEST_URL: "",
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

const profile = {
  full_name: "Test Reader", role: "Product Manager", about: "a".repeat(300),
  send_hour: 19, timezone: "Europe/London", is_active: false,
};
const topics = [{ key: "topic-1", name: "Technology", description: "AI research", sources: ["ft.com"] }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
});

describe("Save all settings", () => {
  it("saves profile, delivery, topics, and both source lists in one action", async () => {
    await saveAllSettings("reader-1", profile, topics, ["bbc.com"]);
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(profile);
    expect(mocks.eq).toHaveBeenCalledWith("id", "reader-1");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_topics_and_sources", {
      p_topics: [{ name: "Technology", description: "AI research", sources: ["ft.com"] }],
      p_general: ["bbc.com"],
    });
  });

  it("does not report success when topics or sources fail to save", async () => {
    const error = new Error("source limit");
    mocks.rpc.mockResolvedValue({ error });
    await expect(saveAllSettings("reader-1", profile, topics, [])).rejects.toBe(error);
  });

  it("stops when the profile and delivery update fails", async () => {
    const error = new Error("network");
    mocks.eq.mockResolvedValue({ error });
    await expect(saveAllSettings("reader-1", profile, topics, [])).rejects.toBe(error);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});