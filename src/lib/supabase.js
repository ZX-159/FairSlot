import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !anon) {
  console.warn(
    '[FairSlot] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and paste your Supabase keys (see SETUP.md).'
  );
}

// createClient throws on empty url — use a harmless placeholder so the UI still mounts
// and surfaces a clear auth/config error instead of a white screen.
const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anon || 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default supabase;
