// Supabase Edge Function: confirm a Square POS payment and record it.
//
// Called by the terminal after the Square Point of Sale app hands back to
// /terminal/square-callback, and again from "Check again" on a stuck order.
// Body: { order_id: number, transaction_id?: string }.
//
// Secrets (supabase secrets set ...):
//   SQUARE_ACCESS_TOKEN  - from the Square Developer Dashboard. Required.
//   SQUARE_ENVIRONMENT   - "production" (default) or "sandbox".
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyPayment, type Deps } from "./verify.ts";

// Pinned so a Square API change can't alter response shapes underneath us.
const SQUARE_VERSION = "2025-01-23";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function squareBaseUrl(): string {
  const env = (Deno.env.get("SQUARE_ENVIRONMENT") ?? "").trim().toLowerCase();
  if (env === "sandbox") return "https://connect.squareupsandbox.com";
  if (env && env !== "production") {
    console.warn(`SQUARE_ENVIRONMENT="${env}" is not valid; using production.`);
  }
  return "https://connect.squareup.com";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed", message: "Use POST." });

  const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN")?.trim();
  if (!accessToken) {
    return json(503, {
      code: "not_configured",
      message: "Square isn't configured on the server: set the SQUARE_ACCESS_TOKEN secret.",
    });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Staff only. The service-role client below bypasses RLS, so the caller's
  // own session is checked here rather than relying on gateway settings.
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } };
  if (!auth.user) return json(401, { code: "unauthorized", message: "Sign in first." });

  let body: { order_id?: unknown; transaction_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { code: "invalid_request", message: "Body must be JSON." });
  }

  const baseUrl = squareBaseUrl();
  const deps: Deps = {
    async square(path) {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Square-Version": SQUARE_VERSION,
          Accept: "application/json",
        },
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    async getOrder(id) {
      const { data, error } = await db
        .from("orders")
        .select("id, status, subtotal, payment_status, payment_reference")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async saveReference(orderId, reference) {
      const { error } = await db.from("orders").update({ payment_reference: reference }).eq("id", orderId);
      if (error) throw error;
    },
    async findPayments(paymentIds) {
      const { data, error } = await db
        .from("payments")
        .select("provider_payment_id, order_id")
        .eq("provider", "square")
        .in("provider_payment_id", paymentIds);
      if (error) throw error;
      return data ?? [];
    },
    async insertPayments(rows) {
      const { error } = await db
        .from("payments")
        .upsert(rows, { onConflict: "provider,provider_payment_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    async markPaid(orderId) {
      const { error } = await db
        .from("orders")
        .update({ payment_status: "paid", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
  };

  try {
    const result = await verifyPayment(deps, {
      orderId: body.order_id,
      transactionId: body.transaction_id,
    });
    return result.ok ? json(200, result) : json(result.httpStatus, result);
  } catch (err) {
    console.error("square-verify-payment failed:", err);
    return json(500, { code: "internal_error", message: "Couldn't record the payment. Try again." });
  }
});
