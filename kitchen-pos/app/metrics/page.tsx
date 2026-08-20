"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import { Campaign } from "../types";
import {
  getAllCampaigns,
  getCampaignOrdersForMetrics,
  computeCampaignMetrics,
  inferDefaultGranularity,
  TimeslotGranularity,
  CampaignMetrics,
} from "../lib/supabase";
import { formatCurrency, formatDuration } from "../lib/format";
import ThemeToggle from "../components/ThemeToggle";
import CampaignSelector from "../components/terminal/CampaignSelector";
import StatCard from "../components/metrics/StatCard";
import BreakdownTable from "../components/metrics/BreakdownTable";
import TimeslotTable from "../components/metrics/TimeslotTable";

export default function MetricsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [granularity, setGranularity] = useState<TimeslotGranularity | null>(null);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const data = await getAllCampaigns();
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

  // Takes an explicit granularity rather than reading the `granularity` state
  // closure — falling back to a stale closure value on campaign switch would
  // keep the previous campaign's granularity instead of re-inferring a default.
  const loadMetrics = useCallback(
    async (campaign: Campaign, requestedGranularity?: TimeslotGranularity) => {
      try {
        setIsLoadingMetrics(true);
        setError(null);
        const orders = await getCampaignOrdersForMetrics(campaign.id);
        const resolvedGranularity =
          requestedGranularity ?? inferDefaultGranularity(orders);
        setGranularity(resolvedGranularity);
        setMetrics(computeCampaignMetrics(orders, resolvedGranularity));
      } catch (err) {
        console.error("Error loading metrics:", err);
        setError("Failed to load metrics for this campaign.");
      } finally {
        setIsLoadingMetrics(false);
      }
    },
    []
  );

  // Reload metrics whenever the selected campaign changes; granularity
  // resets to the campaign's inferred default on each campaign switch.
  useEffect(() => {
    if (!selectedCampaign) return;
    setGranularity(null);
    loadMetrics(selectedCampaign);
  }, [selectedCampaign, loadMetrics]);

  const handleGranularityChange = (next: TimeslotGranularity) => {
    if (!selectedCampaign) return;
    loadMetrics(selectedCampaign, next);
  };

  const handleRefresh = () => {
    if (!selectedCampaign) return;
    loadMetrics(selectedCampaign, granularity ?? undefined);
  };

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
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <svg
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
            title="Refresh metrics"
          >
            <svg
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
          <CampaignSelector
            campaigns={campaigns}
            selectedCampaign={selectedCampaign}
            onSelectCampaign={setSelectedCampaign}
          />
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
        ) : !selectedCampaign || isLoadingMetrics || !metrics ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatCard label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} />
              <StatCard
                label="Items Ordered"
                value={metrics.itemsOrdered.toLocaleString()}
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
            {granularity && (
              <TimeslotTable
                timeslots={metrics.timeslots}
                granularity={granularity}
                onGranularityChange={handleGranularityChange}
                busiestKey={metrics.busiestTimeslot?.key ?? null}
              />
            )}

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
