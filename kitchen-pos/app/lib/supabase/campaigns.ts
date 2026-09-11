import { supabase } from "./client";
import type { Campaign } from "@/app/types";

/**
 * Fetch all campaigns, active and archived, ordered by start date (most
 * recent first). Archived ones stay in the result so the campaign picker
 * can list and reactivate them - callers that only want active campaigns
 * filter client-side (see CampaignSelector).
 */
export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("Error fetching campaigns:", error);
    throw error;
  }

  return data || [];
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

