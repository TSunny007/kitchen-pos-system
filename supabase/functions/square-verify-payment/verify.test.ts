// Runs under Node (`node --test supabase/functions`) or `deno test`; uses
// only node: built-ins and fake dependencies, never the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPayment, toMinorUnits, type Deps, type OrderRow, type PaymentRow } from "./verify.ts";

function payment(id: string, amount: number, tip: number, status = "COMPLETED", currency = "USD") {
  return {
    payment: {
      id,
      status,
      amount_money: { amount, currency },
      tip_money: { amount: tip, currency },
      total_money: { amount: amount + tip, currency },
    },
  };
}

function fakeDeps(opts: {
  order?: Partial<OrderRow> | null;
  square?: Record<string, { status: number; body: unknown }>;
  existing?: { provider_payment_id: string; order_id: number }[];
}) {
  const calls = { saved: [] as string[], inserted: [] as PaymentRow[], paid: [] as number[], squarePaths: [] as string[] };
  const order: OrderRow | null =
    opts.order === null
      ? null
      : { id: 7, status: "new", subtotal: 12.5, payment_status: "awaiting", payment_reference: null, ...opts.order };
  const deps: Deps = {
    async square(path) {
      calls.squarePaths.push(path);
      return opts.square?.[path] ?? { status: 404, body: null };
    },
    async getOrder() {
      return order;
    },
    async saveReference(_id, ref) {
      calls.saved.push(ref);
    },
    async findPayments() {
      return opts.existing ?? [];
    },
    async insertPayments(rows) {
      calls.inserted.push(...rows);
    },
    async markPaid(id) {
      calls.paid.push(id);
    },
  };
  return { deps, calls };
}

const happySquare = {
  "/v2/orders/TX1": { status: 200, body: { order: { id: "TX1", tenders: [{ payment_id: "PAY1" }] } } },
  "/v2/payments/PAY1": { status: 200, body: payment("PAY1", 1250, 300) },
};

test("records base, tip, and total and marks the order paid", async () => {
  const { deps, calls } = fakeDeps({ square: happySquare });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX1" });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.saved, ["TX1"]);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].base_amount_minor, 1250);
  assert.equal(calls.inserted[0].tip_amount_minor, 300);
  assert.equal(calls.inserted[0].total_amount_minor, 1550);
  assert.equal(calls.inserted[0].provider_order_id, "TX1");
  assert.deepEqual(calls.paid, [7]);
});

test("retries from the saved reference when no transaction id is passed", async () => {
  const { deps, calls } = fakeDeps({ order: { payment_reference: "TX1" }, square: happySquare });
  const result = await verifyPayment(deps, { orderId: 7 });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.saved, []);
});

test("an already-paid order is a no-op success", async () => {
  const { deps, calls } = fakeDeps({ order: { payment_status: "paid" } });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX1" });
  assert.deepEqual(result, { ok: true, alreadyRecorded: true, payments: [] });
  assert.equal(calls.squarePaths.length, 0);
});

test("rejects a base amount that doesn't match the order", async () => {
  const { deps, calls } = fakeDeps({
    square: { ...happySquare, "/v2/payments/PAY1": { status: 200, body: payment("PAY1", 100, 0) } },
  });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX1" });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "amount_mismatch");
  assert.equal(calls.paid.length, 0);
});

test("rejects a payment already recorded against another order", async () => {
  const { deps, calls } = fakeDeps({
    square: happySquare,
    existing: [{ provider_payment_id: "PAY1", order_id: 99 }],
  });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX1" });
  assert.equal(!result.ok && result.code, "payment_already_used");
  assert.equal(calls.inserted.length, 0);
});

test("re-recording the same payment for the same order succeeds", async () => {
  const { deps } = fakeDeps({ square: happySquare, existing: [{ provider_payment_id: "PAY1", order_id: 7 }] });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX1" });
  assert.equal(result.ok, true);
});

test("an incomplete payment isn't recorded", async () => {
  const { deps, calls } = fakeDeps({
    square: { ...happySquare, "/v2/payments/PAY1": { status: 200, body: payment("PAY1", 1250, 0, "APPROVED") } },
  });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX1" });
  assert.equal(!result.ok && result.code, "payment_not_completed");
  assert.equal(calls.paid.length, 0);
});

test("unknown Square transaction reports not found but keeps the reference", async () => {
  const { deps, calls } = fakeDeps({ square: {} });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX404" });
  assert.equal(!result.ok && result.code, "square_not_found");
  assert.deepEqual(calls.saved, ["TX404"]);
});

test("a bad access token is reported as such", async () => {
  const { deps } = fakeDeps({ square: { "/v2/orders/TX1": { status: 401, body: {} } } });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX1" });
  assert.equal(!result.ok && result.code, "square_unauthorized");
});

test("validates input before touching anything", async () => {
  const { deps, calls } = fakeDeps({});
  for (const input of [{ orderId: "7" }, { orderId: -1 }, { orderId: 7, transactionId: "../v2/x" }]) {
    const result = await verifyPayment(deps, input);
    assert.equal(!result.ok && result.code, "invalid_request");
  }
  assert.equal(calls.squarePaths.length, 0);
});

test("refuses orders that aren't awaiting a card payment", async () => {
  for (const [order, code] of [
    [{ payment_status: "cash" }, "not_awaiting_payment"],
    [{ payment_status: "untracked" }, "not_awaiting_payment"],
    [{ status: "cancelled" }, "order_voided"],
    [{ payment_reference: null }, "no_reference"],
  ] as const) {
    const { deps } = fakeDeps({ order, square: happySquare });
    const result = await verifyPayment(deps, { orderId: 7 });
    assert.equal(!result.ok && result.code, code);
  }
  const { deps } = fakeDeps({ order: null });
  const result = await verifyPayment(deps, { orderId: 7, transactionId: "TX1" });
  assert.equal(!result.ok && result.code, "order_not_found");
});

test("minor units follow the currency's exponent", () => {
  assert.equal(toMinorUnits(12.5, "USD"), 1250);
  assert.equal(toMinorUnits(0.1 + 0.2, "USD"), 30);
  assert.equal(toMinorUnits(1200, "JPY"), 1200);
});
