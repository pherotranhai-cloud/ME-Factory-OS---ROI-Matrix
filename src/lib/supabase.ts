import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Database & Storage features may fail.');
}

// Fallback to a dummy object if missing to prevent page crash on load.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      storage: {
        from: () => ({
          upload: async () => ({ error: new Error("Supabase is not configured.") }),
          getPublicUrl: () => ({ data: { publicUrl: "" } })
        })
      }
    } as any;
