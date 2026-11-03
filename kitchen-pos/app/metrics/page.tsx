"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import { Campaign } from "../types";
import {
  getCampaigns,
  getCampaignOrdersForMetrics,
  computeCampaignMetrics,
  inferDefaultGranularity,
  TimeslotGranularity,
  MetricsOrder,
} from "../lib/supabase";
import { formatCount, formatCurrency, formatDuration } from "../lib/format";
import ThemeToggle from "../components/ThemeToggle";
import StatCard from "../components/metrics/StatCard";
import BreakdownTable from "../components/metrics/BreakdownTable";
import TimeslotTable from "../components/metrics/TimeslotTable";

export default function MetricsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [orders, setOrders] = useState<MetricsOrder[] | null>(null);
  const [granularity, setGranularity] = useState<TimeslotGranularity>("hour");
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    async function loadCampaigns() {
      try {
        setIsLoadingCampaigns(true);
        setError(null);
        const data = await getCampaigns({ includeArchived: true });
        setCampaigns(data);
        if (data.length > 0) {
          setSelectedCampaign((current) => current ?? data[0]);
        }
      } catch (err) {
        console.error("Error loading campaigns:", err);
        setError("Failed to load campaigns. Please check your connection.");
      } finally {
        setIsLoadingCampaigns(false);
      }
    }

    loadCampaigns();
  }, [user]);

  // A campaign switch clears the previous campaign's orders and re-infers the
  // granularity; a refresh keeps both. Requests can overlap (switching away
  // from a slow campaign), so only the newest one may write state, and a
  // failure clears the orders rather than leaving stale numbers under the
  // current campaign's name.
  const loadOrders = useCallback(
    async (campaign: Campaign, { isSwitch }: { isSwitch: boolean }) => {
      const requestId = ++latestRequest.current;
      setIsLoadingMetrics(true);
      setError(null);
      if (isSwitch) setOrders(null);
      try {
        const data = await getCampaignOrdersForMetrics(campaign.id);
        if (requestId !== latestRequest.current) return;
        if (isSwitch) setGranularity(inferDefaultGranularity(data));
        setOrders(data);
      } catch (err) {
        if (requestId !== latestRequest.current) return;
        console.error("Error loading metrics:", err);
        setOrders(null);
        setError("Failed to load metrics for this campaign.");
      } finally {
        if (requestId === latestRequest.current) setIsLoadingMetrics(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedCampaign) return;
    loadOrders(selectedCampaign, { isSwitch: true });
  }, [selectedCampaign, loadOrders]);

  const handleRefresh = () => {
    if (!selectedCampaign) return;
    loadOrders(selectedCampaign, { isSwitch: false });
  };

  // Re-bucketing is a pure function of data already on the client, so the
  // Hourly/Daily toggle never refetches.
  const metrics = useMemo(
    () => (orders ? computeCampaignMetrics(orders, granularity) : null),
    [orders, granularity]
  );

  const activeCampaigns = campaigns.filter((c) => c.is_active);
  const archivedCampaigns = campaigns.filter((c) => !c.is_active);

  const revenueByItemRows = useMemo(
    () =>
      (metrics?.revenueByItem ?? []).map((row) => ({
        key: String(row.itemId),
        label: row.itemName,
        sublabel: `${row.quantity}x`,
        value: row.revenue,
        displayValue: formatCurrency(row.revenue),
      })),
    [metrics]
  );

  const revenueByCategoryRows = useMemo(
    () =>
      (metrics?.revenueByCategory ?? []).map((row) => ({
        key: row.categoryId !== null ? String(row.categoryId) : "uncategorized",
        label: row.categoryName,
        sublabel: `${row.itemsOrdered} items`,
        value: row.revenue,
        displayValue: formatCurrency(row.revenue),
      })),
    [metrics]
  );

  const revenueByModifierRows = useMemo(
    () =>
      (metrics?.revenueByModifier ?? []).map((row) => ({
        key: row.key,
        label: row.label,
        sublabel: `${row.quantity}x`,
        value: row.revenue,
        displayValue: formatCurrency(row.revenue),
      })),
    [metrics]
  );

  const timeToServeByItemRows = useMemo(
    () =>
      (metrics?.timeToServeByItem ?? []).map((row) => ({
        key: String(row.itemId),
        label: row.itemName,
        sublabel: `${row.samples}x`,
        value: row.avgSeconds,
        displayValue: formatDuration(row.avgSeconds),
      })),
    [metrics]
  );

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            aria-label="Back to home"
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 sm:h-6 sm:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-medium text-on-surface sm:text-2xl">
              Metrics
            </h1>
            <p className="text-xs text-on-surface-variant sm:text-sm">
              {selectedCampaign ? selectedCampaign.name : "Select a campaign"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleRefresh}
            disabled={!selectedCampaign || isLoadingMetrics}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50"
            aria-label="Refresh metrics"
            title="Refresh metrics"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 sm:h-6 sm:w-6 ${isLoadingMetrics ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <ThemeToggle />
          {/* Not the terminal's CampaignSelector: there, picking an archived
              campaign reactivates it. Reviewing a past campaign must not
              change it, so a plain select lists every campaign read-only. */}
          <select
            aria-label="Campaign"
            value={selectedCampaign?.id ?? ""}
            onChange={(e) =>
              setSelectedCampaign(
                campaigns.find((c) => c.id === Number(e.target.value)) ?? null
              )
            }
            disabled={campaigns.length === 0}
            className="max-w-48 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface sm:max-w-64"
          >
            {activeCampaigns.length > 0 && (
              <optgroup label="Active">
                {activeCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {archivedCampaigns.length > 0 && (
              <optgroup label="Archived">
                {archivedCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-error-container bg-error-container p-4 text-sm text-on-error-container">
            {error}
          </div>
        )}

        {isLoadingCampaigns ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : campaigns.length === 0 ? (
          <p className="py-16 text-center text-on-surface-variant">
            No campaigns yet.
          </p>
        ) : !metrics ? (
          // On a failed load the error banner above is the whole story; the
          // header refresh button retries.
          !error && (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatCard label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} />
              <StatCard
                label="Items Ordered"
                value={formatCount(metrics.itemsOrdered)}
                sublabel={`${metrics.orderCount} order${metrics.orderCount !== 1 ? "s" : ""}`}
              />
              <StatCard
                label="Avg Order Value"
                value={formatCurrency(metrics.averageOrderValue)}
              />
              <StatCard
                label="Avg Time to Serve"
                value={
                  metrics.averageTimeToServeSeconds !== null
                    ? formatDuration(metrics.averageTimeToServeSeconds)
                    : "—"
                }
                sublabel="per item"
              />
              <StatCard
                label="Avg Order Completion"
                value={
                  metrics.averageOrderCompletionSeconds !== null
                    ? formatDuration(metrics.averageOrderCompletionSeconds)
                    : "—"
                }
                sublabel="per order"
              />
              <StatCard
                label="Busiest Timeslot"
                value={metrics.busiestTimeslot?.label ?? "—"}
                sublabel={
                  metrics.busiestTimeslot
                    ? `${metrics.busiestTimeslot.itemsOrdered} items`
                    : undefined
                }
              />
            </div>

            {/* Timeslot activity */}
            <TimeslotTable
              timeslots={metrics.timeslots}
              granularity={granularity}
              onGranularityChange={setGranularity}
              busiestKey={metrics.busiestTimeslot?.key ?? null}
            />

            {/* Breakdowns */}
            <div>
              <h2 className="mb-3 text-sm font-medium text-on-surface-variant">
                Breakdowns
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <BreakdownTable title="Revenue by Item" rows={revenueByItemRows} />
                <BreakdownTable
                  title="Revenue by Category"
                  rows={revenueByCategoryRows}
                />
                <BreakdownTable
                  title="Revenue by Modifier"
                  rows={revenueByModifierRows}
                  emptyLabel="No modifiers ordered"
                />
                <BreakdownTable
                  title="Time to Serve by Item"
                  rows={timeToServeByItemRows}
                  emptyLabel="No completed items yet"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
