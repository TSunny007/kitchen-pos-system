import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client factory
// Use this in Server Components, API routes, and server actions
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Supabase publishable key (new format) with fallback to legacy anon key
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  // Prefer the highest-privilege key available: secret key (new format) >
  // service role key (legacy format) > publishable/anon key
  const key = supabaseSecretKey || supabaseServiceKey || supabasePublishableKey;

  if (!key) {
    throw new Error("Missing Supabase key");
  }

  return createClient(supabaseUrl, key);
}
