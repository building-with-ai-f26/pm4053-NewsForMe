import { DEMO_URL, SUGGEST_URL, supabase } from "./supabase";

export type DraftTopic = {
  key: string;
  name: string;
  description: string;
  sources: string[];
  custom?: boolean;
};

export type Suggestion = { name: string; description: string; sources: string[] };

let counter = 0;
export const newKey = () => `t${Date.now()}_${counter++}`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function fetchSuggestions(body: {
  mode: "suggest" | "sources";
  about: string;
  role: string;
  topics?: string[];
}): Promise<Suggestion[]> {
  const res = await fetch(SUGGEST_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`suggest ${res.status}`);
  const json = await res.json();
  if (!json?.ok || !Array.isArray(json.topics)) throw new Error("bad response");
  return json.topics.map((t: Suggestion) => ({
    name: String(t.name ?? "").slice(0, 80),
    description: String(t.description ?? "").slice(0, 400),
    sources: Array.isArray(t.sources) ? t.sources.map(String) : [],
  }));
}

export async function sendDemo(): Promise<boolean> {
  try {
    const res = await fetch(DEMO_URL, { method: "POST", headers: await authHeaders(), body: "{}" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Replace all topics and sources in one database transaction. */
export async function replaceTopicsAndSources(
  _userId: string,
  topics: DraftTopic[],
  globalSources: string[],
) {
  const { error } = await supabase.rpc("save_topics_and_sources", {
    p_topics: topics.map((t) => ({
      name: t.name.trim().slice(0, 80),
      description: t.description.trim().slice(0, 400),
      sources: t.sources,
    })),
    p_general: globalSources,
  });
  if (error) throw error;
}

/** Save every editable settings section using the existing database operations. */
export async function saveAllSettings(
  userId: string,
  profile: {
    full_name: string | null;
    role: string | null;
    about: string;
    send_hour: number;
    timezone: string;
    is_active: boolean;
  },
  topics: DraftTopic[],
  globalSources: string[],
) {
  const { error } = await supabase.from("profiles").update(profile).eq("id", userId);
  if (error) throw error;
  await replaceTopicsAndSources(userId, topics, globalSources);
}
