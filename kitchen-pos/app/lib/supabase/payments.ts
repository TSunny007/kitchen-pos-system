import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./client";

export type VerifyPaymentResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Ask the square-verify-payment Edge Function to confirm an order's card
 * payment with Square and record it. Pass the transaction id from the POS
 * callback the first time; omit it to retry with the one already saved.
 *
 * Returns a result rather than throwing: every failure here is one the cashier
 * has to read and act on, not an exception to log.
 */
export async function verifySquarePayment(
  orderId: number,
  transactionId?: string
): Promise<VerifyPaymentResult> {
  const { error } = await supabase.functions.invoke("square-verify-payment", {
    body: { order_id: orderId, transaction_id: transactionId },
  });
  if (!error) return { ok: true };

  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.message) return { ok: false, code: body.code ?? "error", message: body.message };
  }
  console.error("Error verifying Square payment:", error);
  return {
    ok: false,
    code: "unreachable",
    message: "Couldn't reach the payment server. Check the connection and try again.",
  };
}

/** The manual fallback when a card payment can't be taken or confirmed. */
export async function markOrderPaidInCash(orderId: number): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "cash", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    console.error("Error marking order paid in cash:", error);
    throw error;
  }
}

/**
 * Abandon an order that was never paid. Its items are cancelled with it so
 * nothing downstream counts them as sold.
 */
export async function voidOrder(orderId: number): Promise<void> {
  const now = new Date().toISOString();
  const { error: itemsError } = await supabase
    .from("order_items")
    .update({ status: "cancelled", updated_at: now })
    .eq("order_id", orderId);
  if (itemsError) {
    console.error("Error voiding order items:", itemsError);
    throw itemsError;
  }
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", orderId);
  if (error) {
    console.error("Error voiding order:", error);
    throw error;
  }
}
