import { supabase } from "./client";
import type {
  Order,
  OrderItem,
  CartItem,
  OrderStatus,
  OrderItemStatus,
} from "@/app/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { aggregateItemStatus } from "@/app/lib/orderStatus";

// Shared PostgREST select shapes - these were repeated verbatim across the
// order queries, so a change to what the kitchen or terminal needs had to be
// made in several places at once.
const ORDER_WITH_ITEMS = `
  *,
  order_items (
    *,
    item:items(*),
    modifiers:order_item_modifiers(*)
  )
`;

const ORDER_ITEM_WITH_RELATIONS = `
  *,
  item:items(*),
  modifiers:order_item_modifiers(*)
`;

// ============ Order Creation ============

export interface CreateOrderInput {
  campaign_id: number | null;
  customer_name: string;
  notes?: string;
  items: CartItem[];
}

/**
 * Create a new order with all its items and modifiers
 * This performs multiple inserts but Supabase doesn't support true transactions
 * in the client SDK, so we do our best to maintain consistency
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { campaign_id, customer_name, notes, items } = input;

  // Calculate subtotal
  const subtotal = items.reduce((total, cartItem) => {
    const itemTotal = cartItem.item.base_price * cartItem.quantity;
    const modifiersTotal = cartItem.modifiers.reduce(
      (sum, mod) => sum + mod.price_delta * cartItem.quantity,
      0
    );
    return total + itemTotal + modifiersTotal;
  }, 0);

  // 1. Create the order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      campaign_id,
      customer_name,
      notes: notes || null,
      subtotal,
      status: "new" as OrderStatus,
    })
    .select()
    .single();

  if (orderError) {
    console.error("Error creating order:", orderError);
    throw orderError;
  }

  // 2. Create order items - FLATTENED: one row per unit (quantity is always 1)
  // This allows individual items to be checked off in the kitchen, even with different modifiers
  // Items with no_prep_needed=true are created with status 'done' (ready immediately)
  const orderItemsToInsert: Array<{
    order_id: number;
    item_id: number;
    quantity: number;
    notes: string | null;
    status: OrderItemStatus;
  }> = [];

  // Track which cart item index each order item corresponds to
  const cartItemIndexMap: number[] = [];

  items.forEach((cartItem, cartIndex) => {
    // Create one order_item for each unit in the quantity
    for (let i = 0; i < cartItem.quantity; i++) {
      orderItemsToInsert.push({
        order_id: order.id,
        item_id: cartItem.item.id,
        quantity: 1, // Always 1 for flattened items
        notes: cartItem.notes || null,
        status: (cartItem.item.no_prep_needed ? "done" : "new") as OrderItemStatus,
      });
      cartItemIndexMap.push(cartIndex);
    }
  });

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsToInsert)
    .select();

  if (itemsError) {
    console.error("Error creating order items:", itemsError);
    // Try to clean up the order we just created
    await supabase.from("orders").delete().eq("id", order.id);
    throw itemsError;
  }

  // 3. Create order item modifiers
  // Each flattened order item gets its own copy of the modifiers
  const orderItemModifiersToInsert: Array<{
    order_item_id: number;
    modifier_id: number;
    label: string;
    price_delta: number;
  }> = [];

  orderItems.forEach((orderItem, orderItemIndex) => {
    const cartIndex = cartItemIndexMap[orderItemIndex];
    const cartItem = items[cartIndex];
    cartItem.modifiers.forEach((modifier) => {
      orderItemModifiersToInsert.push({
        order_item_id: orderItem.id,
        modifier_id: modifier.id,
        label: modifier.name,
        price_delta: modifier.price_delta,
      });
    });
  });

  if (orderItemModifiersToInsert.length > 0) {
    const { error: modifiersError } = await supabase
      .from("order_item_modifiers")
      .insert(orderItemModifiersToInsert);

    if (modifiersError) {
      console.error("Error creating order item modifiers:", modifiersError);
      // Continue anyway - the order exists, just without modifiers recorded
    }
  }

  // 4. Create initial status events for each order item
  // Use the actual status that was set (done for no_prep_needed items, new otherwise)
  const statusEventsToInsert = orderItems.map((orderItem, orderItemIndex) => {
    const cartIndex = cartItemIndexMap[orderItemIndex];
    return {
      order_item_id: orderItem.id,
      old_status: null,
      new_status: items[cartIndex].item.no_prep_needed ? "done" : "new",
    };
  });

  const { error: statusError } = await supabase
    .from("order_item_status_events")
    .insert(statusEventsToInsert);

  if (statusError) {
    console.error("Error creating status events:", statusError);
    // Continue anyway - tracking is optional
  }

  // 5. Decrement stock for items with tracking enabled.
  // Aggregates quantities per item_id before decrementing (since items are flattened).
  // Uses an atomic DB function so the check constraint (stock >= 0) is the safety net.
  if (campaign_id) {
    const stockDecrements = new Map<number, number>();
    for (const cartItem of items) {
      stockDecrements.set(
        cartItem.item.id,
        (stockDecrements.get(cartItem.item.id) ?? 0) + cartItem.quantity
      );
    }

    for (const [itemId, qty] of stockDecrements) {
      const { error: stockError } = await supabase.rpc(
        "decrement_campaign_item_stock",
        { p_campaign_id: campaign_id, p_item_id: itemId, p_quantity: qty }
      );
      if (stockError) {
        console.error("Error decrementing stock for item", itemId, stockError);
        // Don't fail the order — stock is a best-effort tracking layer
      }
    }
  }

  return order;
}

// ============ Order Queries ============

/** Apply an optional single-or-many status filter to an orders query. */
function withStatusFilter<Q extends {
  in(column: "status", values: OrderStatus[]): Q;
  eq(column: "status", value: OrderStatus): Q;
}>(query: Q, status?: OrderStatus | OrderStatus[]): Q {
  if (!status) return query;
  return Array.isArray(status)
    ? query.in("status", status)
    : query.eq("status", status);
}

export interface PaginatedOrdersResult {
  orders: Order[];
  hasMore: boolean;
  totalCount: number;
}

/**
 * Fetch paginated orders for a campaign
 */
export async function getRecentOrders(
  campaignId: number,
  options: {
    page?: number;
    pageSize?: number;
    status?: OrderStatus | OrderStatus[];
  } = {}
): Promise<PaginatedOrdersResult> {
  const { page = 1, pageSize = 10, status } = options;
  const offset = (page - 1) * pageSize;

  // First get total count
  const countQuery = withStatusFilter(
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId),
    status
  );

  const { count } = await countQuery;
  const totalCount = count || 0;

  // Then fetch the page
  const query = withStatusFilter(
    supabase
      .from("orders")
      .select(ORDER_WITH_ITEMS)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .order("id", { referencedTable: "order_items", ascending: true })
      .range(offset, offset + pageSize - 1),
    status
  );

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching paginated orders:", error);
    throw error;
  }

  return {
    orders: data || [],
    hasMore: offset + pageSize < totalCount,
    totalCount,
  };
}

/**
 * Fetch a single order by ID with all its items and modifiers
 */
export async function getOrderById(id: number): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_WITH_ITEMS)
    .eq("id", id)
    .order("id", { referencedTable: "order_items", ascending: true })
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching order:", error);
    throw error;
  }

  return data;
}

// ============ Order Updates ============

/**
 * Update multiple order items' status at once (for batch category updates)
 * Also updates the parent order status based on all item statuses
 */
export async function updateMultipleOrderItemsStatus(
  orderItemIds: number[],
  newStatus: OrderItemStatus
): Promise<void> {
  if (orderItemIds.length === 0) return;

  // Get order_ids for all items
  const { data: items, error: fetchError } = await supabase
    .from("order_items")
    .select("id, status, order_id")
    .in("id", orderItemIds);

  if (fetchError) {
    console.error("Error fetching order items:", fetchError);
    throw fetchError;
  }

  // Update all items
  const { error: updateError } = await supabase
    .from("order_items")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .in("id", orderItemIds);

  if (updateError) {
    console.error("Error updating order items status:", updateError);
    throw updateError;
  }

  // Log status events for all items
  const statusEvents = items.map((item) => ({
    order_item_id: item.id,
    old_status: item.status,
    new_status: newStatus,
  }));

  const { error: eventError } = await supabase
    .from("order_item_status_events")
    .insert(statusEvents);

  if (eventError) {
    console.error("Error logging status events:", eventError);
    // Don't throw - the update succeeded
  }

  // Update parent orders for all affected orders
  const uniqueOrderIds = [...new Set(items.map((item) => item.order_id))];
  for (const orderId of uniqueOrderIds) {
    await updateOrderStatusFromItems(orderId);
  }
}

/**
 * Compute and update the order status based on the statuses of all its items
 * Rules:
 * - Order is "new" if all items are "new"
 * - Order is "in_progress" if any item is "in_progress" or some items are done but not all
 * - Order is "completed" if all non-cancelled items are "done"
 */
export async function updateOrderStatusFromItems(orderId: number): Promise<void> {
  // Fetch all items for this order
  const { data: items, error: fetchError } = await supabase
    .from("order_items")
    .select("status")
    .eq("order_id", orderId);

  if (fetchError) {
    console.error("Error fetching order items:", fetchError);
    return;
  }

  if (!items || items.length === 0) return;

  // Filter out cancelled items for status calculation
  const activeItems = items.filter((item) => item.status !== "cancelled");
  
  if (activeItems.length === 0) {
    // All items cancelled
    const { error: cancelError } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (cancelError) {
      console.error(`Error marking order ${orderId} cancelled:`, cancelError);
    }
    return;
  }

  // Order-level "completed" is just the item-level "done" rollup under a
  // different name; everything else maps across unchanged.
  const aggregate = aggregateItemStatus(activeItems);
  const newOrderStatus: OrderStatus =
    aggregate === "done" ? "completed" : aggregate;

  // Get current order status to avoid unnecessary updates
  const { data: currentOrder, error: orderFetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (orderFetchError) {
    console.error("Error fetching order:", orderFetchError);
    return;
  }

  // Don't downgrade from completed or cancelled
  if (currentOrder.status === "cancelled") {
    return;
  }
  
  if (currentOrder.status === "completed" && newOrderStatus !== "completed") {
    return;
  }

  // Only update if status actually changed
  if (currentOrder.status !== newOrderStatus) {
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (updateError) {
      console.error(`Error updating order ${orderId} to status "${newOrderStatus}":`, updateError);
    }
  }
}

export interface UpdateOrderItemInput {
  quantity: number;
  notes: string | null;
  modifierIds: number[];
}

/**
 * Update an order item's quantity, notes, and modifiers
 * Also recalculates the order subtotal
 */
export async function updateOrderItem(
  orderItemId: number,
  updates: UpdateOrderItemInput
): Promise<OrderItem> {
  const { quantity, notes, modifierIds } = updates;

  // 1. Get the current order item with its order info
  const { data: currentItem, error: fetchError } = await supabase
    .from("order_items")
    .select(ORDER_ITEM_WITH_RELATIONS)
    .eq("id", orderItemId)
    .single();

  if (fetchError) {
    console.error("Error fetching order item:", fetchError);
    throw fetchError;
  }

  // 2. Update the order item.
  //
  // `.select().single()` is load-bearing even though the row isn't used: it
  // makes PostgREST fail with PGRST116 when the update matched nothing (the
  // row was concurrently deleted, or is filtered out by RLS for this user).
  // Without it a zero-row update reports success, and we would go on to
  // rewrite this item's modifiers and recalculate the order subtotal as
  // though the edit had landed.
  const { error: updateError } = await supabase
    .from("order_items")
    .update({
      quantity,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderItemId)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating order item:", updateError);
    throw updateError;
  }

  // 3. Delete existing modifiers for this order item
  const { error: deleteModError } = await supabase
    .from("order_item_modifiers")
    .delete()
    .eq("order_item_id", orderItemId);

  if (deleteModError) {
    console.error("Error deleting order item modifiers:", deleteModError);
    // Continue anyway
  }

  // 4. Insert new modifiers
  if (modifierIds.length > 0) {
    // Fetch modifier details
    const { data: modifiers, error: modFetchError } = await supabase
      .from("modifiers")
      .select("*")
      .in("id", modifierIds);

    if (modFetchError) {
      console.error("Error fetching modifiers:", modFetchError);
    } else if (modifiers) {
      const newModifiers = modifiers.map((mod) => ({
        order_item_id: orderItemId,
        modifier_id: mod.id,
        label: mod.name,
        price_delta: mod.price_delta,
      }));

      const { error: insertModError } = await supabase
        .from("order_item_modifiers")
        .insert(newModifiers);

      if (insertModError) {
        console.error("Error inserting order item modifiers:", insertModError);
      }
    }
  }

  // 5. Recalculate and update order subtotal
  await recalculateOrderSubtotal(currentItem.order_id);

  // 6. Fetch and return the updated item with all relations
  const { data: finalItem, error: finalError } = await supabase
    .from("order_items")
    .select(ORDER_ITEM_WITH_RELATIONS)
    .eq("id", orderItemId)
    .single();

  if (finalError) {
    console.error("Error fetching final order item:", finalError);
    throw finalError;
  }

  return finalItem;
}

/**
 * Delete an order item and recalculate the order subtotal
 */
export async function deleteOrderItem(orderItemId: number): Promise<void> {
  // 1. Get the order ID first
  const { data: item, error: fetchError } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("id", orderItemId)
    .single();

  if (fetchError) {
    console.error("Error fetching order item:", fetchError);
    throw fetchError;
  }

  const orderId = item.order_id;

  // 2. Delete the order item (modifiers will cascade delete due to FK)
  const { error: deleteError } = await supabase
    .from("order_items")
    .delete()
    .eq("id", orderItemId);

  if (deleteError) {
    console.error("Error deleting order item:", deleteError);
    throw deleteError;
  }

  // 3. Recalculate order subtotal
  await recalculateOrderSubtotal(orderId);
}

/**
 * Recalculate and update the order subtotal based on its items
 */
async function recalculateOrderSubtotal(orderId: number): Promise<void> {
  // Fetch all items for this order
  const { data: items, error: fetchError } = await supabase
    .from("order_items")
    .select(`
      quantity,
      item:items(base_price),
      modifiers:order_item_modifiers(price_delta)
    `)
    .eq("order_id", orderId);

  if (fetchError) {
    console.error("Error fetching order items for subtotal:", fetchError);
    return;
  }

  // Calculate new subtotal
  const subtotal = (items || []).reduce((total, orderItem) => {
    // Supabase returns single relations as arrays, so we need to handle that
    const itemData = orderItem.item as unknown;
    const basePrice = Array.isArray(itemData) 
      ? (itemData[0] as { base_price: number } | undefined)?.base_price || 0
      : (itemData as { base_price: number } | null)?.base_price || 0;
    const modifiersPrice = ((orderItem.modifiers as { price_delta: number }[] | null) || [])
      .reduce((sum, mod) => sum + mod.price_delta, 0);
    return total + (basePrice + modifiersPrice) * orderItem.quantity;
  }, 0);

  // Update the order
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      subtotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateError) {
    console.error("Error updating order subtotal:", updateError);
  }
}

// ============ Real-time Subscriptions ============

type OrderChangeHandler = (
  eventType: "INSERT" | "UPDATE" | "DELETE",
  order: Order
) => void;

/**
 * Subscribe to the `orders` table for one campaign.
 *
 * Realtime payloads only carry the `orders` row, so INSERT/UPDATE re-fetch the
 * full order with its items before handing it over; DELETE has nothing left to
 * fetch and passes the old row through.
 */
function subscribeToOrderRows(
  channelName: string,
  campaignId: number,
  onOrderChange: OrderChangeHandler
): RealtimeChannel {
  return supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `campaign_id=eq.${campaignId}`,
      },
      async (payload) => {
        const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";

        if (eventType === "DELETE") {
          onOrderChange(eventType, payload.old as Order);
          return;
        }

        const fullOrder = await getOrderById((payload.new as Order).id);
        if (fullOrder) {
          onOrderChange(eventType, fullOrder);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to all order changes for a campaign
 */
export function subscribeToOrders(
  campaignId: number,
  onOrderChange: OrderChangeHandler
): () => void {
  const channel = subscribeToOrderRows(
    `orders-${campaignId}`,
    campaignId,
    onOrderChange
  );

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============ Kitchen Display Functions ============

/**
 * Fetch active orders for kitchen display (new, in_progress, completed)
 * 'completed' is included because it's the aggregate item-level "Ready"
 * state (see updateOrderStatusFromItems) - excluding it would make orders
 * disappear from the kitchen display the moment they're fully done.
 * These are orders that kitchen staff need to see and work on.
 */
export async function getKitchenOrders(campaignId: number): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_WITH_ITEMS)
    .eq("campaign_id", campaignId)
    .in("status", ["new", "in_progress", "completed"])
    .order("created_at", { ascending: true }) // Oldest first for kitchen
    .order("id", { referencedTable: "order_items", ascending: true });

  if (error) {
    console.error("Error fetching kitchen orders:", error);
    throw error;
  }

  return data || [];
}

/**
 * Subscribe to kitchen order changes.
 *
 * Same order-row stream as subscribeToOrders, plus a second channel on
 * order_items: the kitchen advances individual items, and those updates don't
 * always touch the parent order row, so they'd otherwise go unnoticed.
 */
export function subscribeToKitchenOrders(
  campaignId: number,
  onOrderChange: OrderChangeHandler
): () => void {
  const orderChannel = subscribeToOrderRows(
    `kitchen-orders-${campaignId}`,
    campaignId,
    onOrderChange
  );

  const itemsChannel: RealtimeChannel = supabase
    .channel(`kitchen-order-items-${campaignId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "order_items" },
      async (payload) => {
        const orderItem = payload.new as { order_id: number };
        const fullOrder = await getOrderById(orderItem.order_id);
        if (fullOrder && fullOrder.campaign_id === campaignId) {
          onOrderChange("UPDATE", fullOrder);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(orderChannel);
    supabase.removeChannel(itemsChannel);
  };
}
