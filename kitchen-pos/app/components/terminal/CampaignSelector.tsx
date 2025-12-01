"use client";

import { useState, useRef, useEffect } from "react";
import { Campaign } from "../../types";

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  onSelectCampaign: (campaign: Campaign) => void;
  onCreateCampaign?: (name: string) => Promise<Campaign>;
  onToggleCampaignActive?: (campaignId: number, isActive: boolean) => Promise<void>;
}

export default function CampaignSelector({
  campaigns,
  selectedCampaign,
  onSelectCampaign,
  onCreateCampaign,
  onToggleCampaignActive,
}: CampaignSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setNewCampaignName("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const activeCampaigns = campaigns.filter((c) => c.is_active);
  const inactiveCampaigns = campaigns.filter((c) => !c.is_active);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim() || !onCreateCampaign) return;

    setIsSubmitting(true);
    try {
      await onCreateCampaign(newCampaignName.trim());
      setNewCampaignName("");
      setIsCreating(false);
    } catch (err) {
      console.error("Error creating campaign:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (e: React.MouseEvent, campaign: Campaign) => {
    e.stopPropagation();
    if (!onToggleCampaignActive) return;

    try {
      await onToggleCampaignActive(campaign.id, !campaign.is_active);
    } catch (err) {
      console.error("Error toggling campaign:", err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef} data-lpignore="true" data-form-type="other">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-surface-container px-2 py-2 transition-all hover:bg-surface-container-high sm:gap-3 sm:px-4 sm:py-3"
        data-lpignore="true"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container sm:h-10 sm:w-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-on-primary-container sm:h-5 sm:w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-xs text-on-surface-variant">Campaign</p>
          <p className="max-w-[150px] truncate font-medium text-on-surface">
            {selectedCampaign?.name || "Select Campaign"}
          </p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-on-surface-variant transition-transform sm:ml-2 sm:h-5 sm:w-5 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl bg-surface-container-low shadow-[var(--md-elevation-2)]">
          <div className="p-2">
            {/* Create new campaign */}
            {onCreateCampaign && (
              <div className="mb-2 border-b border-outline-variant pb-2">
                {isCreating ? (
                  <div className="flex items-center gap-2 px-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateCampaign();
                        if (e.key === "Escape") {
                          setIsCreating(false);
                          setNewCampaignName("");
                        }
                      }}
                      placeholder="Campaign name..."
                      className="flex-1 rounded-lg border border-outline bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                      disabled={isSubmitting}
                      data-lpignore="true"
                      data-form-type="other"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCampaign}
                      disabled={isSubmitting || !newCampaignName.trim()}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
                    >
                      {isSubmitting ? "..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setNewCampaignName("");
                      }}
                      className="rounded-lg px-2 py-2 text-on-surface-variant hover:bg-surface-container"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-surface-container"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Campaign
                  </button>
                )}
              </div>
            )}

            {/* Active campaigns */}
            <p className="px-3 py-2 text-xs font-medium text-on-surface-variant">
              Active Campaigns
            </p>
            {activeCampaigns.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-on-surface-variant">
                No active campaigns
              </p>
            ) : (
              activeCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                    selectedCampaign?.id === campaign.id
                      ? "bg-secondary-container"
                      : "hover:bg-surface-container-high"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCampaign(campaign);
                      setIsOpen(false);
                    }}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        selectedCampaign?.id === campaign.id
                          ? "text-on-secondary-container"
                          : "text-on-surface"
                      }`}>
                        {campaign.name}
                      </p>
                      {campaign.starts_at && (
                        <p className="text-xs text-on-surface-variant">
                          {new Date(campaign.starts_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {selectedCampaign?.id === campaign.id && (
                      <svg className="h-5 w-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  {onToggleCampaignActive && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleActive(e, campaign)}
                      className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-error"
                      title="Deactivate campaign"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}

            {/* Inactive campaigns */}
            {inactiveCampaigns.length > 0 && (
              <>
                <p className="mt-2 px-3 py-2 text-xs font-medium text-on-surface-variant">
                  Inactive Campaigns
                </p>
                {inactiveCampaigns.slice(0, 5).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 opacity-60 hover:bg-surface-container-high hover:opacity-100"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onToggleCampaignActive) {
                          onToggleCampaignActive(campaign.id, true);
                        }
                      }}
                      className="flex flex-1 items-center gap-3 text-left"
                      title="Click to reactivate"
                    >
                      <div className="h-2 w-2 rounded-full bg-outline" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-on-surface">{campaign.name}</p>
                        {campaign.starts_at && (
                          <p className="text-xs text-on-surface-variant">
                            {new Date(campaign.starts_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </button>
                    {onToggleCampaignActive && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleActive(e, campaign)}
                        className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-success"
                        title="Reactivate campaign"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
