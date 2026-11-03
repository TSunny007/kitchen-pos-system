"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRequireAuth } from "../lib/useRequireAuth";
import { Campaign, CampaignBalance, LedgerEntry } from "../types";
import {
  getCampaigns,
  firstActiveCampaign,
  getCampaignBalances,
  getLedgerEntries,
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
} from "../lib/supabase";
import type { LedgerEntryInput } from "../lib/supabase";
import { netOf, sumBalances } from "../lib/ledger";
import { formatCurrency, formatDate, formatPriceDelta } from "../lib/format";
import ThemeToggle from "../components/ThemeToggle";
import StationHeader from "../components/StationHeader";
import { LoadingScreen, ErrorScreen } from "../components/StatusScreen";
import { PlusIcon, RefreshIcon } from "../components/icons";
import CampaignBalanceRow, {
  BalanceColumnHeaders,
  amountClass,
} from "../components/balance/CampaignBalanceRow";
import LedgerEntryModal from "../components/balance/LedgerEntryModal";
import { tenant } from "../config/tenant";

/** Which row is open. The "not tied to a campaign" row has no id to key on. */
type RowKey = number | "unassigned";

const keyOf = (campaignId: number | null): RowKey => campaignId ?? "unassigned";
const campaignIdOf = (key: RowKey): number | null =>
  key === "unassigned" ? null : key;

const NO_FIGURES = { revenue: 0, expenses: 0, additions: 0 };

export default function BalanceSheetPage() {
  const { user, isLoading: authLoading } = useRequireAuth();

  // `null` until the first load lands. After that it is only ever replaced, so
  // a failed refresh leaves the last figures on screen under a banner instead
  // of blanking a page someone may be mid-reconciliation on.
  const [data, setData] = useState<{
    campaigns: Campaign[];
    balances: CampaignBalance[];
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // The open row, and its entries (`null` while they load).
  const [expanded, setExpanded] = useState<RowKey | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [entriesFailed, setEntriesFailed] = useState(false);

  const [modal, setModal] = useState<{
    entry?: LedgerEntry;
    campaignId: number | null;
  } | null>(null);

  // Never throws: callers run it *after* a write has already succeeded, and a
  // failed re-read must not make the form report that the write failed — the
  // operator would retry and enter it twice.
  const refresh = useCallback(async () => {
    try {
      const [campaigns, balances] = await Promise.all([
        getCampaigns({ includeArchived: true }),
        getCampaignBalances(),
      ]);
      setData({ campaigns, balances });
      setLoadFailed(false);
    } catch (err) {
      console.error("Error loading balance sheet:", err);
      setLoadFailed(true);
    }
  }, []);

  // Fetching once auth resolves is the intended use of an effect. `refresh`
  // only sets state after its first await, so nothing here is synchronous; the
  // rule can't see across the await.
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refresh();
    }
  }, [user, refresh]);

  // Rows are opened and closed faster than the network answers, so only the
  // latest request may write state. Same non-throwing contract as `refresh`.
  const entriesRequest = useRef(0);
  const loadEntries = useCallback(async (campaignId: number | null) => {
    const request = ++entriesRequest.current;
    try {
      const rows = await getLedgerEntries(campaignId);
      if (request !== entriesRequest.current) return;
      setEntries(rows);
      setEntriesFailed(false);
    } catch {
      if (request !== entriesRequest.current) return;
      setEntriesFailed(true);
    }
  }, []);

  const openRow = (key: RowKey) => {
    setExpanded(key);
    setEntries(null);
    setEntriesFailed(false);
    loadEntries(campaignIdOf(key));
  };

  const handleToggle = (key: RowKey) => {
    if (expanded === key) {
      entriesRequest.current++; // drop any response still in flight
      setExpanded(null);
    } else {
      openRow(key);
    }
  };

  const handleRefresh = () => {
    refresh();
    if (expanded !== null) loadEntries(campaignIdOf(expanded));
  };

  // After any write: re-read the totals, and open the row the entry landed on
  // so the person sees where it went — which, when they edit an entry onto
  // another campaign, is not the row they started from.
  const afterChange = async (campaignId: number | null) => {
    if (expanded !== keyOf(campaignId)) openRow(keyOf(campaignId));
    await Promise.all([refresh(), loadEntries(campaignId)]);
  };

  const handleSave = async (input: LedgerEntryInput) => {
    if (modal?.entry) {
      await updateLedgerEntry(modal.entry.id, input);
    } else {
      await createLedgerEntry(input);
    }
    await afterChange(input.campaign_id);
  };

  const handleDelete = async () => {
    const entry = modal?.entry;
    if (!entry) return;
    await deleteLedgerEntry(entry.id);
    await afterChange(entry.campaign_id);
  };

  const orgFigures = useMemo(() => sumBalances(data?.balances ?? []), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const byCampaign = new Map(data.balances.map((b) => [b.campaign_id, b]));

    const list = data.campaigns.map((campaign) => ({
      key: campaign.id as RowKey,
      name: campaign.name,
      detail: [
        campaign.is_active ? null : "Archived",
        campaign.starts_at ? formatDate(campaign.starts_at) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      figures: byCampaign.get(campaign.id) ?? NO_FIGURES,
    }));

    // Only present when some order or entry belongs to no campaign.
    const untied = byCampaign.get(null);
    if (untied) {
      list.push({
        key: "unassigned",
        name: "Not tied to a campaign",
        detail: "",
        figures: untied,
      });
    }
    return list;
  }, [data]);

  if (authLoading || !user || (data === null && !loadFailed)) {
    return <LoadingScreen message="Loading balance sheet..." />;
  }

  if (data === null) {
    return <ErrorScreen message="Failed to load the balance sheet. Please check your connection." />;
  }

  const orgNet = netOf(orgFigures);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <StationHeader
        title={tenant.stations.balanceSheet.heading}
        actions={
          <>
            <button
              onClick={handleRefresh}
              className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <ThemeToggle />
            <button
              onClick={() =>
                setModal({
                  campaignId:
                    expanded !== null
                      ? campaignIdOf(expanded)
                      : (firstActiveCampaign(data.campaigns)?.id ?? null),
                })
              }
              aria-label="Add entry"
              title="Add entry"
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 sm:px-4"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Add entry</span>
            </button>
          </>
        }
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {loadFailed && (
            <div
              role="alert"
              className="flex items-center justify-between gap-4 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              <span>Couldn&apos;t refresh. These are the last figures that loaded.</span>
              <button onClick={handleRefresh} className="shrink-0 font-medium underline">
                Try again
              </button>
            </div>
          )}

          <section
            aria-label="Organisation total"
            className="rounded-3xl bg-surface-container p-6"
          >
            <p className="text-sm font-medium text-on-surface-variant">
              Net profit, all campaigns
            </p>
            <p className={`mt-1 text-4xl font-semibold ${amountClass(orgNet)}`}>
              {formatCurrency(orgNet)}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-outline-variant pt-4">
              <div>
                <dt className="text-xs text-on-surface-variant">Revenue</dt>
                <dd className="font-medium text-on-surface">
                  {formatCurrency(orgFigures.revenue)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant">Expenses</dt>
                <dd className={`font-medium ${amountClass(orgFigures.expenses)}`}>
                  {formatPriceDelta(orgFigures.expenses)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant">Additions</dt>
                <dd className={`font-medium ${amountClass(orgFigures.additions)}`}>
                  {formatPriceDelta(orgFigures.additions)}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="by-campaign">
            <h2 id="by-campaign" className="mb-3 text-lg font-medium text-on-surface">
              By campaign
            </h2>

            {rows.length === 0 ? (
              <p className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-center text-on-surface-variant">
                No campaigns yet.
              </p>
            ) : (
              <>
                <BalanceColumnHeaders />
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <CampaignBalanceRow
                      key={row.key}
                      panelId={`entries-${row.key}`}
                      name={row.name}
                      detail={row.detail}
                      figures={row.figures}
                      isExpanded={expanded === row.key}
                      onToggle={() => handleToggle(row.key)}
                      entries={entries}
                      entriesFailed={entriesFailed}
                      onAddEntry={() => setModal({ campaignId: campaignIdOf(row.key) })}
                      onEditEntry={(entry) =>
                        setModal({ entry, campaignId: entry.campaign_id })
                      }
                    />
                  ))}
                </ul>
              </>
            )}

            <p className="mt-4 text-xs text-on-surface-variant">
              Revenue counts completed orders only, so it trails the kitchen
              until orders are marked done. Expenses and additions are the
              entries added here.
            </p>
          </section>
        </div>
      </main>

      {modal && (
        <LedgerEntryModal
          campaigns={data.campaigns}
          entry={modal.entry}
          defaultCampaignId={modal.campaignId}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal.entry ? handleDelete : undefined}
        />
      )}
    </div>
  );
}
