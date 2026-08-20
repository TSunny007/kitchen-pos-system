import { supabase } from "./client";
import type { Campaign } from "@/app/types";

/**
 * Fetch all active campaigns, ordered by start date (most recent first)
 */
export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("is_active", true)
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("Error fetching campaigns:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch all campaigns regardless of active state, ordered by start date
 * (most recent first). Used by the Metrics page, where reviewing a past
 * (deactivated) campaign is the common case — unlike getCampaigns(), which
 * only returns active campaigns for the operational Terminal/Kitchen views.
 */
export async function getAllCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("Error fetching all campaigns:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a single campaign by ID
 */
export async function getCampaignById(id: number): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Error fetching campaign:", error);
    throw error;
  }

  return data;
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  campaign: Omit<Campaign, "id" | "created_at">
): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert(campaign)
    .select()
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    throw error;
  }

  return data;
}

/**
 * Update an existing campaign
 */
export async function updateCampaign(
  id: number,
  updates: Partial<Omit<Campaign, "id" | "created_at">>
): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating campaign:", error);
    throw error;
  }

  return data;
}

/**
 * Deactivate a campaign (soft delete)
 */
export async function deactivateCampaign(id: number): Promise<void> {
  const { error } = await supabase
    .from("campaigns")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("Error deactivating campaign:", error);
    throw error;
  }
}
