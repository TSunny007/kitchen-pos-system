import { supabase } from "./client";
import type { CampaignBalance, LedgerEntry } from "@/app/types";

/**
 * Revenue, expenses and additions for every campaign, plus a row for money
 * tied to none.
 *
 * Read from the `campaign_balance` view rather than summed here: PostgREST
 * truncates a response at 1000 rows without saying so, and adding up every
 * order item across every campaign in the browser would hit that quietly. See
 * the migration for what counts as revenue.
 */
export async function getCampaignBalances(): Promise<CampaignBalance[]> {
  const { data, error } = await supabase.from("campaign_balance").select("*");

  if (error) {
    console.error("Error fetching campaign balances:", error);
    throw error;
  }

  return data || [];
}

/**
 * One campaign's ledger entries, newest first - or, for `null`, the entries
 * tied to no campaign. `eq("campaign_id", null)` would match nothing (SQL
 * `= NULL`), which is why that case needs its own `is`.
 */
export async function getLedgerEntries(
  campaignId: number | null
): Promise<LedgerEntry[]> {
  const base = supabase.from("ledger_entries").select("*");
  const { data, error } = await (
    campaignId === null
      ? base.is("campaign_id", null)
      : base.eq("campaign_id", campaignId)
  )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Error fetching ledger entries:", error);
    throw error;
  }

  return data || [];
}

export type LedgerEntryInput = Pick<
  LedgerEntry,
  "campaign_id" | "label" | "amount"
>;

export async function createLedgerEntry(
  entry: LedgerEntryInput
): Promise<LedgerEntry> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .insert(entry)
    .select()
    .single();

  if (error) {
    console.error("Error creating ledger entry:", error);
    throw error;
  }

  return data;
}

export async function updateLedgerEntry(
  id: number,
  updates: LedgerEntryInput
): Promise<LedgerEntry> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating ledger entry:", error);
    throw error;
  }

  return data;
}

export async function deleteLedgerEntry(id: number): Promise<void> {
  const { error } = await supabase.from("ledger_entries").delete().eq("id", id);

  if (error) {
    console.error("Error deleting ledger entry:", error);
    throw error;
  }
}
