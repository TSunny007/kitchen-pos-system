import { supabase } from "./client";
import type { Item, Modifier, ItemModifier } from "@/app/types";

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
