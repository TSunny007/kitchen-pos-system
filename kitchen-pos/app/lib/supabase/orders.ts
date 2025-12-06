import { supabase } from "./client";
import type {
  Order,
  OrderItem,
  OrderItemModifier,
  CartItem,
  OrderStatus,
  OrderItemStatus,
} from "@/app/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

  // 2. Create order items
  // Items with no_prep_needed=true are created with status 'done' (ready immediately)
  const orderItemsToInsert = items.map((cartItem) => ({
    order_id: order.id,
    item_id: cartItem.item.id,
    quantity: cartItem.quantity,
    notes: cartItem.notes || null,
    status: (cartItem.item.no_prep_needed ? "done" : "new") as OrderItemStatus,
  }));

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
  const orderItemModifiersToInsert: Array<{
    order_item_id: number;
    modifier_id: number;
    label: string;
    price_delta: number;
  }> = [];

  items.forEach((cartItem, index) => {
    const orderItem = orderItems[index];
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
  const statusEventsToInsert = orderItems.map((orderItem, index) => ({
    order_item_id: orderItem.id,
    old_status: null,
    new_status: items[index].item.no_prep_needed ? "done" : "new",
  }));

  const { error: statusError } = await supabase
    .from("order_item_status_events")
    .insert(statusEventsToInsert);

  if (statusError) {
    console.error("Error creating status events:", statusError);
    // Continue anyway - tracking is optional
  }

  return order;
}

// ============ Order Queries ============

/**
 * Fetch orders for a campaign with optional status filter
 */
export async function getOrders(
  campaignId?: number,
  status?: OrderStatus | OrderStatus[]
): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        item:items(*),
        modifiers:order_item_modifiers(*)
      )
    `
    )
    .order("created_at", { ascending: false })
    .order("id", { referencedTable: "order_items", ascending: true });

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  if (status) {
    if (Array.isArray(status)) {
      query = query.in("status", status);
    } else {
      query = query.eq("status", status);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }

  return data || [];
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
  let countQuery = supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (status) {
    if (Array.isArray(status)) {
      countQuery = countQuery.in("status", status);
    } else {
      countQuery = countQuery.eq("status", status);
    }
  }

  const { count } = await countQuery;
  const totalCount = count || 0;

  // Then fetch the page
  let query = supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        item:items(*),
        modifiers:order_item_modifiers(*)
      )
    `
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .order("id", { referencedTable: "order_items", ascending: true })
    .range(offset, offset + pageSize - 1);

  if (status) {
    if (Array.isArray(status)) {
      query = query.in("status", status);
    } else {
      query = query.eq("status", status);
    }
  }

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
    .select(
      `
      *,
      order_items (
        *,
        item:items(*),
        modifiers:order_item_modifiers(*)
      )
    `
    )
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

/**
 * Fetch orders that are ready for pickup
 */
export async function getReadyOrders(campaignId?: number): Promise<Order[]> {
  return getOrders(campaignId, "ready");
}

// ============ Order Updates ============

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus
): Promise<Order> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status:", error);
    throw error;
  }

  return data;
}

/**
 * Update order item status and log the transition
 * Also updates the parent order status based on all item statuses
 */
export async function updateOrderItemStatus(
  orderItemId: number,
  newStatus: OrderItemStatus
): Promise<OrderItem> {
  // First, get current status and order_id
  const { data: currentItem, error: fetchError } = await supabase
    .from("order_items")
    .select("status, order_id")
    .eq("id", orderItemId)
    .single();

  if (fetchError) {
    console.error("Error fetching order item:", fetchError);
    throw fetchError;
  }

  const oldStatus = currentItem.status;
  const orderId = currentItem.order_id;

  // Update the status
  const { data: updatedItem, error: updateError } = await supabase
    .from("order_items")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderItemId)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating order item status:", updateError);
    throw updateError;
  }

  // Log the status event
  const { error: eventError } = await supabase
    .from("order_item_status_events")
    .insert({
      order_item_id: orderItemId,
      old_status: oldStatus,
      new_status: newStatus,
    });

  if (eventError) {
    console.error("Error logging status event:", eventError);
    // Don't throw - the update succeeded
  }

  // Update the parent order status based on all item statuses
  await updateOrderStatusFromItems(orderId);

  return updatedItem;
}

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
 * - Order is "ready" if all non-cancelled items are "done" (but not picked_up yet)
 * - Order is "picked_up" when ALL non-cancelled items are "picked_up"
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
    await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return;
  }

  const statuses = activeItems.map((item) => item.status);
  const allNew = statuses.every((s) => s === "new");
  const allDone = statuses.every((s) => s === "done");
  const allPickedUp = statuses.every((s) => s === "picked_up");
  const anyNew = statuses.some((s) => s === "new");
  const anyInProgress = statuses.some((s) => s === "in_progress");
  const anyDone = statuses.some((s) => s === "done");
  const anyPickedUp = statuses.some((s) => s === "picked_up");
  // All done or picked_up (ready for full pickup)
  const allDoneOrPickedUp = statuses.every((s) => s === "done" || s === "picked_up");

  let newOrderStatus: OrderStatus;
  
  if (allPickedUp) {
    newOrderStatus = "picked_up";
  } else if (allDoneOrPickedUp && !anyNew && !anyInProgress) {
    // All items are done or picked_up (mixture is ok) - order is ready
    newOrderStatus = "ready";
  } else if (anyInProgress || anyDone || anyPickedUp) {
    // Some items in progress, or some done but not all
    newOrderStatus = "in_progress";
  } else if (allNew) {
    newOrderStatus = "new";
  } else {
    newOrderStatus = "new";
  }

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

  // Don't downgrade from picked_up or cancelled unless we're computing picked_up
  if (currentOrder.status === "cancelled") {
    return;
  }
  
  if (currentOrder.status === "picked_up" && newOrderStatus !== "picked_up") {
    return;
  }

  // Only update if status actually changed
  if (currentOrder.status !== newOrderStatus) {
    await supabase
      .from("orders")
      .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);
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
    .select(`
      *,
      item:items(*),
      modifiers:order_item_modifiers(*)
    `)
    .eq("id", orderItemId)
    .single();

  if (fetchError) {
    console.error("Error fetching order item:", fetchError);
    throw fetchError;
  }

  // 2. Update the order item
  const { data: updatedItem, error: updateError } = await supabase
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
    .select(`
      *,
      item:items(*),
      modifiers:order_item_modifiers(*)
    `)
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

/**
 * Mark an order as picked up
 */
export async function markOrderPickedUp(orderId: number): Promise<Order> {
  return updateOrderStatus(orderId, "picked_up");
}

// ============ Real-time Subscriptions ============

/**
 * Subscribe to orders that become "ready" status for a campaign
 * Returns an unsubscribe function
 */
export function subscribeToReadyOrders(
  campaignId: number,
  onOrderReady: (order: Order) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`ready-orders-${campaignId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `campaign_id=eq.${campaignId}`,
      },
      async (payload) => {
        const newOrder = payload.new as Order;
        // Only notify if the order just became "ready"
        if (newOrder.status === "ready") {
          // Fetch the full order with items
          const fullOrder = await getOrderById(newOrder.id);
          if (fullOrder) {
            onOrderReady(fullOrder);
          }
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to all order changes for a campaign
 */
export function subscribeToOrders(
  campaignId: number,
  onOrderChange: (eventType: "INSERT" | "UPDATE" | "DELETE", order: Order) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`orders-${campaignId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `campaign_id=eq.${campaignId}`,
      },
      async (payload) => {
        const order = (payload.new || payload.old) as Order;
        const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";

        if (eventType === "DELETE") {
          onOrderChange(eventType, payload.old as Order);
        } else {
          // Fetch full order with items for INSERT/UPDATE
          const fullOrder = await getOrderById(order.id);
          if (fullOrder) {
            onOrderChange(eventType, fullOrder);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============ Kitchen Display Functions ============

/**
 * Fetch active orders for kitchen display (new, in_progress, ready)
 * These are orders that kitchen staff need to see and work on
 */
export async function getKitchenOrders(campaignId: number): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        item:items(*),
        modifiers:order_item_modifiers(*)
      )
    `
    )
    .eq("campaign_id", campaignId)
    .in("status", ["new", "in_progress", "ready"])
    .order("created_at", { ascending: true }) // Oldest first for kitchen
    .order("id", { referencedTable: "order_items", ascending: true });

  if (error) {
    console.error("Error fetching kitchen orders:", error);
    throw error;
  }

  return data || [];
}

/**
 * Subscribe to kitchen order changes (new, in_progress, ready orders)
 * This is optimized for the kitchen display which needs real-time updates
 */
export function subscribeToKitchenOrders(
  campaignId: number,
  onOrderChange: (eventType: "INSERT" | "UPDATE" | "DELETE", order: Order) => void
): () => void {
  const orderChannel: RealtimeChannel = supabase
    .channel(`kitchen-orders-${campaignId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `campaign_id=eq.${campaignId}`,
      },
      async (payload) => {
        const order = (payload.new || payload.old) as Order;
        const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";

        if (eventType === "DELETE") {
          onOrderChange(eventType, payload.old as Order);
        } else {
          // Fetch full order with items for INSERT/UPDATE
          const fullOrder = await getOrderById(order.id);
          if (fullOrder) {
            onOrderChange(eventType, fullOrder);
          }
        }
      }
    )
    .subscribe();

  // Also subscribe to order_items changes to catch item-level status updates
  const itemsChannel: RealtimeChannel = supabase
    .channel(`kitchen-order-items-${campaignId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "order_items",
      },
      async (payload) => {
        const orderItem = payload.new as { order_id: number };
        // Fetch the full order to get updated item statuses
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
