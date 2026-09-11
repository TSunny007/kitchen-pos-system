import { supabase } from "./client";
import type { Campaign } from "@/app/types";

/**
 * Campaigns, newest first.
 *
 * Active-only by default, because that is what a station should be offering
 * an operator. `includeArchived` is opt-in for the one screen that needs the
 * rest - the campaign picker, which can't offer to reactivate a campaign it
 * was never told about. Defaulting the other way would mean every future
 * caller had to remember to filter, and forgetting once puts an archived
 * campaign in front of someone taking orders.
 *
 * `nullsFirst: false` matters: `starts_at` is nullable, and Postgres sorts
 * NULLs first on a DESC order, so an undated campaign would otherwise outrank
 * every real one. `id` breaks ties so the order is stable.
 */
export async function getCampaigns({
  includeArchived = false,
}: { includeArchived?: boolean } = {}): Promise<Campaign[]> {
  let query = supabase.from("campaigns").select("*");
  if (!includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Error fetching campaigns:", error);
    throw error;
  }

  return data || [];
}

/**
 * The campaign a station should open on: the most recent active one, or
 * nothing if every campaign is archived. Both stations ask the same question,
 * so they ask it in one place.
 */
export function firstActiveCampaign(
  campaigns: readonly Campaign[]
): Campaign | undefined {
  return campaigns.find((c) => c.is_active);
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

