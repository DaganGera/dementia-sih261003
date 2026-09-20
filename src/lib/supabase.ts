import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to normalize Supabase URL in case someone pastes the dashboard URL
const normalizeSupabaseUrl = (inputUrl: string): string => {
  let cleaned = inputUrl.trim();
  const match = cleaned.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://${match[1]}.supabase.co`;
  }
  return cleaned;
};

// Retrieve credentials from environment variables or runtime configuration
export const getSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const runtimeUrl = localStorage.getItem('mindcare_supabase_url');
    if (runtimeUrl && runtimeUrl.trim().startsWith('http') && !runtimeUrl.includes('your-project-id')) {
      return normalizeSupabaseUrl(runtimeUrl);
    }
  }
  return normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
};

export const getSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    const runtimeKey = localStorage.getItem('mindcare_supabase_anon_key');
    if (runtimeKey && runtimeKey.trim().length > 20 && !runtimeKey.includes('your-anon-public-key')) {
      return runtimeKey.trim();
    }
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
};

// Check if credentials are authentic and configured
export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  return (
    typeof url === 'string' &&
    url.length > 0 &&
    !url.includes('your-project-id') &&
    url.startsWith('http') &&
    typeof key === 'string' &&
    key.length > 20 &&
    !key.includes('your-anon-public-key')
  );
};

// Function to save runtime Supabase credentials (e.g. from in-app configuration modal)
export const saveRuntimeSupabaseCredentials = (url: string, anonKey: string): void => {
  const normalizedUrl = normalizeSupabaseUrl(url);
  if (typeof window !== 'undefined') {
    localStorage.setItem('mindcare_supabase_url', normalizedUrl);
    localStorage.setItem('mindcare_supabase_anon_key', anonKey.trim());
  }
  // Re-instantiate client
  supabase = createSupabaseClient();
};

// Clear runtime credentials
export const clearRuntimeSupabaseCredentials = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('mindcare_supabase_url');
    localStorage.removeItem('mindcare_supabase_anon_key');
  }
  supabase = createSupabaseClient();
};

function createSupabaseClient(): SupabaseClient {
  const configured = isSupabaseConfigured();
  const safeUrl = configured ? getSupabaseUrl() : 'https://oxvgkfaserkgddbbfkcm.supabase.co';
  const safeKey = configured
    ? getSupabaseAnonKey()
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dmdrZmFzZXJrZ2RkYmJma2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTAxNjUsImV4cCI6MjEwNDY4NjE2NX0.8Z4wI9okDp7nLz-YxM9PK7Xubt77-QdxM00yjGGIFkg';

  return createClient(safeUrl, safeKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export let supabase: SupabaseClient = createSupabaseClient();

if (!isSupabaseConfigured()) {
  console.info(
    'ℹ️ SIROI: Supabase credentials not yet configured. Enter VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env or via the in-app Supabase Connection Setup.'
  );
}
