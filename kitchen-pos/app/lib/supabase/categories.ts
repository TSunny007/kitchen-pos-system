import { supabase } from "./client";
import type { Category } from "@/app/types";

/**
 * Fetch all categories, ordered by display_order
 */
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a single category by ID
 */
export async function getCategoryById(id: number): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching category:", error);
    throw error;
  }

  return data;
}

/**
 * Create a new category
 */
export async function createCategory(
  category: Omit<Category, "id" | "created_at">
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert(category)
    .select()
    .single();

  if (error) {
    console.error("Error creating category:", error);
    throw error;
  }

  return data;
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: number,
  updates: Partial<Omit<Category, "id" | "created_at">>
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating category:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a category
 * First deletes any inactive items linked to this category,
 * then deletes the category itself.
 * Will fail if there are ACTIVE items linked to this category.
 */
export async function deleteCategory(id: number): Promise<void> {
  // First, delete inactive items linked to this category
  const { error: itemsError } = await supabase
    .from("items")
    .delete()
    .eq("category_id", id)
    .eq("is_active", false);

  if (itemsError) {
    console.error("Error deleting inactive items:", itemsError);
    throw itemsError;
  }

  // Now try to delete the category
  // This will fail if there are still active items linked to it
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
}
