"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order } from "../../types";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { LoadingScreen } from "../../components/StatusScreen";
import { formatCurrency } from "../../lib/format";
import { buildChargeUrl, parseCallback } from "../../lib/square";
import {
  getOrderById,
  markOrderPaidInCash,
  verifySquarePayment,
  voidOrder,
} from "../../lib/supabase";

// Long enough to read "Payment confirmed", short enough not to hold up the line.
const RETURN_DELAY_MS = 2500;

function describeOrder(order: Order): string {
  if (order.status === "cancelled") return "This order was voided.";
  switch (order.payment_status) {
    case "paid":
      return "Payment confirmed. Sent to the kitchen.";
    case "cash":
      return "Marked paid in cash. Sent to the kitchen.";
    case "untracked":
      return "This order doesn't need a card payment.";
    case "awaiting":
      return "Awaiting payment. The kitchen won't see this order yet.";
  }
}

/**
 * Where the Square Point of Sale app sends the cashier back to, and where a
 * stuck "Awaiting payment" order is resolved from (`?order=<id>`).
 *
 * The URL is only a hint about what happened; the order row is the truth. So
 * every path ends the same way: re-read the order and offer whatever still
 * makes sense for it.
 */
export default function SquareCallbackPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useRequireAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refreshOrder = useCallback(async (orderId: number) => {
    const fresh = await getOrderById(orderId);
    setOrder(fresh);
    return fresh;
  }, []);

  const verify = useCallback(
    async (orderId: number, transactionId?: string) => {
      setIsWorking(true);
      const result = await verifySquarePayment(orderId, transactionId);
      setMessage(result.ok ? null : result.message);
      await refreshOrder(orderId);
      setIsWorking(false);
    },
    [refreshOrder]
  );

  useEffect(() => {
    if (!user) return;
    const callback = parseCallback(new URLSearchParams(window.location.search));

    (async () => {
      try {
        if (!callback || callback.orderId === null) {
          setMessage(
            callback?.kind === "error"
              ? callback.message
              : "There's no order to resolve here."
          );
          return;
        }
        if (callback.kind === "success") {
          await verify(callback.orderId, callback.transactionId);
          return;
        }
        const current = await refreshOrder(callback.orderId);
        if (callback.kind === "error") {
          setMessage(callback.message);
        } else if (current?.payment_status === "awaiting" && current.payment_reference) {
          // Opened from "Resolve": a transaction id was saved last time, so
          // checking again is the obvious first move.
          await verify(callback.orderId);
        }
      } catch (err) {
        console.error("Error resolving payment:", err);
        setLoadFailed(true);
      } finally {
        setIsWorking(false);
      }
    })();
    // Runs once per sign-in: the URL is read on arrival, not tracked.
  }, [user, verify, refreshOrder]);

  const isSettled = order?.payment_status !== "awaiting" || order.status === "cancelled";

  // A confirmed card payment goes straight back to the till.
  useEffect(() => {
    if (order?.payment_status !== "paid") return;
    const timer = setTimeout(() => router.replace("/terminal"), RETURN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [order?.payment_status, router]);

  const runAction = async (action: () => Promise<void>) => {
    if (!order) return;
    setIsWorking(true);
    try {
      await action();
      setMessage(null);
      await refreshOrder(order.id);
    } catch {
      setMessage("That didn't save. Check the connection and try again.");
    } finally {
      setIsWorking(false);
    }
  };

  if (authLoading || (isWorking && !order && !message)) {
    return <LoadingScreen message="Confirming payment..." />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        {order && (
          <div className="mb-4">
            <p className="text-sm text-on-surface-variant">Order #{order.id}</p>
            <h1 className="text-2xl font-medium text-on-surface">{order.customer_name}</h1>
            <p className="text-lg text-on-surface">{formatCurrency(order.subtotal)}</p>
          </div>
        )}

        <p role="status" className="mb-4 font-medium text-on-surface">
          {isWorking
            ? "Checking with Square..."
            : loadFailed
              ? "Couldn't load this order. Check the connection and reload."
              : order && describeOrder(order)}
        </p>

        {message && !isWorking && (
          <p className="mb-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">
            {message}
          </p>
        )}

        {order && !isSettled && !isWorking && (
          <div className="flex flex-col gap-2">
            {order.payment_reference && (
              <button
                onClick={() => verify(order.id)}
                className="w-full rounded-full bg-primary py-3 font-medium text-on-primary"
              >
                Check again
              </button>
            )}
            <a
              href={buildChargeUrl({
                orderId: order.id,
                amount: order.subtotal,
                origin: window.location.origin,
                userAgent: navigator.userAgent,
              })}
              className="w-full rounded-full border border-outline py-3 text-center font-medium text-on-surface"
            >
              Charge card again
            </a>
            <p className="px-2 text-xs text-on-surface-variant">
              Only charge again if the first payment didn&apos;t go through. Check the Square app&apos;s
              transactions first, or the customer could be charged twice.
            </p>
            <button
              onClick={() => runAction(() => markOrderPaidInCash(order.id))}
              className="w-full rounded-full border border-outline py-3 font-medium text-on-surface"
            >
              Paid in cash
            </button>
            <button
              onClick={() => runAction(() => voidOrder(order.id))}
              className="w-full rounded-full py-3 font-medium text-error"
            >
              Void order
            </button>
          </div>
        )}

        <Link
          href="/terminal"
          className="mt-4 block text-center text-sm text-on-surface-variant underline"
        >
          Back to terminal
        </Link>
      </div>
    </main>
  );
}
