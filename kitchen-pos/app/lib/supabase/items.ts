import { supabase } from "./client";
import type { Item, Modifier, ItemModifier, CampaignItem } from "@/app/types";

/**
 * Fetch all active items, optionally filtered by category
 */
export async function getItems(categoryId?: number): Promise<Item[]> {
  let query = supabase
    .from("items")
    .select("*, category:categories(*)")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching items:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a single item by ID with its category
 */
export async function getItemById(id: number): Promise<Item | null> {
  const { data, error } = await supabase
    .from("items")
    .select("*, category:categories(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching item:", error);
    throw error;
  }

  return data;
}

/**
 * Create a new item
 */
export async function createItem(
  item: Omit<Item, "id" | "created_at" | "updated_at" | "category">
): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .insert(item)
    .select()
    .single();

  if (error) {
    console.error("Error creating item:", error);
    throw error;
  }

  return data;
}

/**
 * Update an existing item
 */
export async function updateItem(
  id: number,
  updates: Partial<Omit<Item, "id" | "created_at" | "updated_at" | "category">>
): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating item:", error);
    throw error;
  }

  return data;
}

/**
 * Deactivate an item (soft delete)
 */
export async function deactivateItem(id: number): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error deactivating item:", error);
    throw error;
  }
}

// ============ Modifiers ============

/**
 * Fetch all active modifiers
 */
export async function getModifiers(): Promise<Modifier[]> {
  const { data, error } = await supabase
    .from("modifiers")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching modifiers:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch modifiers for a specific item (via item_modifiers junction table)
 */
export async function getModifiersForItem(itemId: number): Promise<Modifier[]> {
  const { data, error } = await supabase
    .from("item_modifiers")
    .select("modifier:modifiers(*)")
    .eq("item_id", itemId);

  if (error) {
    console.error("Error fetching item modifiers:", error);
    throw error;
  }

  // Extract modifiers from the joined result and filter active ones
  return (data || [])
    .map((im) => im.modifier as unknown as Modifier)
    .filter((m) => m && m.is_active);
}

/**
 * Create a new modifier
 */
export async function createModifier(
  modifier: Omit<Modifier, "id" | "created_at" | "updated_at">
): Promise<Modifier> {
  const { data, error } = await supabase
    .from("modifiers")
    .insert(modifier)
    .select()
    .single();

  if (error) {
    console.error("Error creating modifier:", error);
    throw error;
  }

  return data;
}

/**
 * Update an existing modifier
 */
export async function updateModifier(
  id: number,
  updates: Partial<Omit<Modifier, "id" | "created_at" | "updated_at">>
): Promise<Modifier> {
  const { data, error } = await supabase
    .from("modifiers")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating modifier:", error);
    throw error;
  }

  return data;
}

/**
 * Deactivate a modifier (soft delete)
 */
export async function deactivateModifier(id: number): Promise<void> {
  const { error } = await supabase
    .from("modifiers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error deactivating modifier:", error);
    throw error;
  }
}

/**
 * Link a modifier to an item
 */
export async function linkModifierToItem(
  itemId: number,
  modifierId: number
): Promise<ItemModifier> {
  const { data, error } = await supabase
    .from("item_modifiers")
    .insert({ item_id: itemId, modifier_id: modifierId })
    .select()
    .single();

  if (error) {
    console.error("Error linking modifier to item:", error);
    throw error;
  }

  return data;
}

/**
 * Unlink a modifier from an item
 */
export async function unlinkModifierFromItem(
  itemId: number,
  modifierId: number
): Promise<void> {
  const { error } = await supabase
    .from("item_modifiers")
    .delete()
    .eq("item_id", itemId)
    .eq("modifier_id", modifierId);

  if (error) {
    console.error("Error unlinking modifier from item:", error);
    throw error;
  }
}

// ============ Campaign Items ============

/**
 * Fetch all items for a specific campaign, including per-campaign stock
 */
export async function getItemsForCampaign(campaignId: number): Promise<Item[]> {
  const { data, error } = await supabase
    .from("campaign_items")
    .select("stock, item:items(*, category:categories(*))")
    .eq("campaign_id", campaignId);

  if (error) {
    console.error("Error fetching campaign items:", error);
    throw error;
  }

  return (data || [])
    .map((ci) => {
      const item = ci.item as unknown as Item;
      return { ...item, stock: ci.stock as number | null };
    })
    .filter((item) => item && item.is_active);
}

/**
 * Get all campaign_items entries for a campaign
 */
export async function getCampaignItems(campaignId: number): Promise<CampaignItem[]> {
  const { data, error } = await supabase
    .from("campaign_items")
    .select("*")
    .eq("campaign_id", campaignId);

  if (error) {
    console.error("Error fetching campaign items:", error);
    throw error;
  }

  return data || [];
}

/**
 * Link an item to a campaign
 */
export async function linkItemToCampaign(
  campaignId: number,
  itemId: number
): Promise<CampaignItem> {
  const { data, error } = await supabase
    .from("campaign_items")
    .insert({ campaign_id: campaignId, item_id: itemId })
    .select()
    .single();

  if (error) {
    console.error("Error linking item to campaign:", error);
    throw error;
  }

  return data;
}

/**
 * Unlink an item from a campaign
 */
export async function unlinkItemFromCampaign(
  campaignId: number,
  itemId: number
): Promise<void> {
  const { error } = await supabase
    .from("campaign_items")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("item_id", itemId);

  if (error) {
    console.error("Error unlinking item from campaign:", error);
    throw error;
  }
}

/**
 * Update the stock count for a campaign item.
 * Pass null to disable stock tracking for that item.
 */
export async function updateCampaignItemStock(
  campaignId: number,
  itemId: number,
  stock: number | null
): Promise<void> {
  const { error } = await supabase
    .from("campaign_items")
    .update({ stock })
    .eq("campaign_id", campaignId)
    .eq("item_id", itemId);

  if (error) {
    console.error("Error updating campaign item stock:", error);
    throw error;
  }
}

/**
 * Subscribe to stock changes for all items in a campaign.
 * Fires whenever any campaign_item row is updated (e.g. after an order decrements stock).
 */
export function subscribeToCampaignItemStock(
  campaignId: number,
  onStockChange: (itemId: number, stock: number | null) => void
): () => void {
  const channel = supabase
    .channel(`campaign-item-stock-${campaignId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "campaign_items",
        filter: `campaign_id=eq.${campaignId}`,
      },
      (payload) => {
        const updated = payload.new as { item_id: number; stock: number | null };
        onStockChange(updated.item_id, updated.stock);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Bulk link multiple items to a campaign
 */
export async function bulkLinkItemsToCampaign(
  campaignId: number,
  itemIds: number[]
): Promise<CampaignItem[]> {
  const entries = itemIds.map((itemId) => ({
    campaign_id: campaignId,
    item_id: itemId,
  }));

  const { data, error } = await supabase
    .from("campaign_items")
    .insert(entries)
    .select();

  if (error) {
    console.error("Error bulk linking items to campaign:", error);
    throw error;
  }

  return data || [];
}
