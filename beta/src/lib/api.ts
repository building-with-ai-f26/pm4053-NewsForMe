import type { LogAttributes } from "posthog-js";
import { DEMO_URL, SUGGEST_URL, supabase } from "./supabase";

export type DraftTopic = {
  key: string;
  name: string;
  description: string;
  sources: string[];
  custom?: boolean;
};

export type Suggestion = { name: string; description: string; sources: string[] };

type AiCaptureClient = {
  capture: (event: string, properties?: Record<string, unknown>) => unknown;
  get_session_id?: () => string | undefined;
  logger?: {
    info: (message: string, attributes?: LogAttributes) => unknown;
    warn: (message: string, attributes?: LogAttributes) => unknown;
  };
};

let counter = 0;
export const newKey = () => `t${Date.now()}_${counter++}`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function logSuggestionRequest(
  posthog: AiCaptureClient | undefined,
  body: { mode: "suggest" | "sources" },
  startedAt: number,
  status: number | undefined,
  success: boolean,
  suggestionCount?: number,
) {
  try {
    posthog?.logger?.[success ? "info" : "warn"](
      success ? "suggestion request completed" : "suggestion request failed",
      {
        request_type: body.mode,
        http_status: status,
        duration_ms: Math.round(performance.now() - startedAt),
        ...(success ? { suggestion_count: suggestionCount } : {}),
      },
    );
  } catch {
    // Logging must not affect the user's suggestion request.
  }
}

function captureSuggestionGeneration(
  posthog: AiCaptureClient | undefined,
  body: { mode: "suggest" | "sources"; about: string; role: string; topics?: string[] },
  startedAt: number,
  status: number | undefined,
  suggestions?: Suggestion[],
) {
  const traceId = globalThis.crypto?.randomUUID?.();
  if (!posthog || !traceId) return;

  try {
    posthog.capture("$ai_generation", {
      $ai_trace_id: traceId,
      $ai_session_id: posthog.get_session_id?.() ?? null,
      $ai_model: "perplexity-via-n8n",
      $ai_provider: "perplexity",
      $ai_input: [
        {
          role: "user",
          content: JSON.stringify({
            request_type: body.mode,
            topic_count: body.topics?.length ?? 0,
          }),
        },
      ],
      $ai_output_choices: suggestions
        ? [
            {
              role: "assistant",
              content: JSON.stringify({ suggestion_count: suggestions.length }),
            },
          ]
        : undefined,
      $ai_input_tokens: null,
      $ai_output_tokens: null,
      $ai_latency: (performance.now() - startedAt) / 1000,
      $ai_http_status: status,
      $ai_is_error: !suggestions,
    });
  } catch {
    // Observability must not affect the user's suggestion request.
  }
}

export async function fetchSuggestions(
  body: {
    mode: "suggest" | "sources";
    about: string;
    role: string;
    topics?: string[];
  },
  posthog?: AiCaptureClient,
): Promise<Suggestion[]> {
  const startedAt = performance.now();
  let status: number | undefined;
  let captured = false;

  try {
    const res = await fetch(SUGGEST_URL, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });
    status = res.status;
    if (!res.ok) {
      captureSuggestionGeneration(posthog, body, startedAt, status);
      captured = true;
      throw new Error(`suggest ${status}`);
    }
    const json = await res.json();
    if (!json?.ok || !Array.isArray(json.topics)) {
      captureSuggestionGeneration(posthog, body, startedAt, status);
      captured = true;
      throw new Error("bad response");
    }
    const suggestions = json.topics.map((t: Suggestion) => ({
      name: String(t.name ?? "").slice(0, 80),
      description: String(t.description ?? "").slice(0, 400),
      sources: Array.isArray(t.sources) ? t.sources.map(String) : [],
    }));
    captureSuggestionGeneration(posthog, body, startedAt, status, suggestions);
    logSuggestionRequest(posthog, body, startedAt, status, true, suggestions.length);
    return suggestions;
  } catch (error) {
    if (!captured) captureSuggestionGeneration(posthog, body, startedAt, status);
    logSuggestionRequest(posthog, body, startedAt, status, false);
    throw error;
  }
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
