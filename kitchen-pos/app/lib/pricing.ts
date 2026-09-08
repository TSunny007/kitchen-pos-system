/**
 * What a line of an order costs, before any formatting.
 *
 * This one function replaces six copies of the same arithmetic. The copies
 * agreed on the answer but not on how they got there: most computed
 * `base*qty + Σ(delta*qty)`, while `OrderCard` and `OrderItemEditModal` used
 * `(base + Σdeltas)*qty`. Those differ by a floating-point ulp at most, but one
 * of the six is not like the others — `createOrder` in `lib/supabase/orders.ts`
 * computes the subtotal that is actually *persisted*, and every later display
 * of that order reads the stored number back. So this adopts createOrder's
 * form, and createOrder now calls this: the price we quote in the cart and the
 * price we store are produced by the same expression, not by two that happen to
 * agree.
 *
 * `cartTotal` exists for the same reason one level up: the sum over the cart is
 * itself written in two places, and an order-level discount or rounding rule
 * added to one and not the other would reintroduce the very drift this module
 * is here to prevent.
 *
 * Pure arithmetic over numbers, deliberately. Currency and locale live in
 * `format.ts`; keeping the money-shaped module separate from the money-display
 * module is what lets a fork change its currency without touching this file.
 */

import type { CartItem } from "../types";

/** Anything carrying a price adjustment — a `Modifier` or a stored `OrderItemModifier`. */
interface PricedDelta {
  price_delta: number;
}

export function lineTotal(
  basePrice: number,
  deltas: readonly PricedDelta[],
  quantity: number
): number {
  const base = basePrice * quantity;
  const modifiers = deltas.reduce((sum, d) => sum + d.price_delta * quantity, 0);
  return base + modifiers;
}

/** What a whole cart comes to — the number quoted, and the number stored. */
export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce(
    (total, cartItem) =>
      total + lineTotal(cartItem.item.base_price, cartItem.modifiers, cartItem.quantity),
    0
  );
}
