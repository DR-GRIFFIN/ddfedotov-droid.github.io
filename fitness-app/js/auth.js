// Sign-in. Local mode works without a server; Supabase sign-in turns on once config.js is filled.
import { config, hasSupabase } from './config.js';
import { store } from './store.js';

let client = null;

async function supabase() {
  if (!hasSupabase()) return null;
  if (!client) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }
  return client;
}

const redirectTo = () => location.origin + location.pathname;

export function startLocal() {
  store.update((s) => {
    s.session = { mode: 'local', userId: s.session?.userId ?? crypto.randomUUID() };
  });
}

export async function signInWithGoogle() {
  const sb = await supabase();
  if (!sb) throw new Error('not-configured');
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  if (error) throw error;
}

export async function signInWithEmail(email) {
  const sb = await supabase();
  if (!sb) throw new Error('not-configured');
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}

// Called on start: picks up a Supabase session after the redirect back from Google or the email link.
export async function restoreSession() {
  const sb = await supabase().catch(() => null);
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  const user = data?.session?.user;
  if (user) store.update((s) => { s.session = { mode: 'supabase', userId: user.id, email: user.email }; });
}

export async function signOut() {
  const sb = await supabase().catch(() => null);
  if (sb) await sb.auth.signOut();
  store.update((s) => { s.session = null; });
}
