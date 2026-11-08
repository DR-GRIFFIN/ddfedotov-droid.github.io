// Server settings. While empty, the app runs in local mode:
// data lives only in this browser, sign-in buttons are disabled.
//
// SUPABASE_URL / SUPABASE_ANON_KEY: from the Supabase project (Settings → API).
// The anon key is public by design; access is limited by Row Level Security.
// AI_WORKER_URL: Cloudflare Worker that holds the Claude API key (next stage).
export const config = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  AI_WORKER_URL: '',
};

export const hasSupabase = () => Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
