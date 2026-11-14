import { createClient } from "@supabase/supabase-js";

// Existing NewsForMe Supabase project. The publishable key is safe in the browser.
export const SUPABASE_URL = "https://xarwkekxuiffkwsxtkhx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EcU0e2U6ryxeiQbesbSQIA_iJrvsO7s";

export const SUGGEST_URL = "https://pm4053.app.n8n.cloud/webhook/newsforme-suggest";
export const DEMO_URL = "https://pm4053.app.n8n.cloud/webhook/newsforme-demo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
