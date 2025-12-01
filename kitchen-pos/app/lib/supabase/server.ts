import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client factory
// Use this in Server Components, API routes, and server actions
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  // Use service role key if available (for admin operations), otherwise anon key
  const key = supabaseServiceKey || supabaseAnonKey;

  if (!key) {
    throw new Error("Missing Supabase key");
  }

  return createClient(supabaseUrl, key);
}
