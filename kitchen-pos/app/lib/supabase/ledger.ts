import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./client";
import { distinctPeople } from "@/app/lib/ledger";
import type { CampaignBalance, LedgerEntry } from "@/app/types";

/** PostgREST's default `max_rows`; a bigger request is cut to this, silently. */
const PAGE_SIZE = 1000;

/**
 * Read a query to the end, a page at a time. A response past `PAGE_SIZE` rows
 * is truncated without an error, which for a list of financial entries means
 * lines quietly missing while the totals above them still include them. The
 * query must have a total order, or pages can overlap or skip.
 */
async function readAll<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
}

/**
 * Revenue, expenses and additions for every campaign, plus a row for money
 * tied to none.
 *
 * Read from the `campaign_balance` view rather than summed here: adding up
 * every order item across every campaign in the browser would hit the row cap
 * above. See the migration for what counts as revenue.
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
  try {
    return await readAll<LedgerEntry>((from, to) => {
      const base = supabase.from("ledger_entries").select("*");
      return (
        campaignId === null
          ? base.is("campaign_id", null)
          : base.eq("campaign_id", campaignId)
      )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
    });
  } catch (error) {
    console.error("Error fetching ledger entries:", error);
    throw error;
  }
}

/**
 * Every name already used in the person field, once each, for the form to
 * suggest. Newest entries first, so `distinctPeople` keeps the capitalisation
 * someone typed most recently.
 */
export async function getLedgerPeople(): Promise<string[]> {
  try {
    const rows = await readAll<{ person: string | null }>((from, to) =>
      supabase
        .from("ledger_entries")
        .select("person")
        .not("person", "is", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    );
    return distinctPeople(rows.map((row) => row.person));
  } catch (error) {
    console.error("Error fetching ledger people:", error);
    throw error;
  }
}

export type LedgerEntryInput = Pick<
  LedgerEntry,
  "campaign_id" | "label" | "person" | "amount"
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
