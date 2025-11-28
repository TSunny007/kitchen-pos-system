"use client";

import { useState, useRef, useEffect } from "react";
import { Campaign } from "../../types";

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  onSelectCampaign: (campaign: Campaign) => void;
}

export default function CampaignSelector({
  campaigns,
  selectedCampaign,
  onSelectCampaign,
}: CampaignSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeCampaigns = campaigns.filter((c) => c.is_active);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-surface-container px-2 py-2 transition-all hover:bg-surface-container-high sm:gap-3 sm:px-4 sm:py-3"
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
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl bg-surface-container-low shadow-[var(--md-elevation-2)]">
          <div className="p-2">
            <p className="px-3 py-2 text-xs font-medium text-on-surface-variant">
              Active Campaigns
            </p>
            {activeCampaigns.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-on-surface-variant">
                No active campaigns
              </p>
            ) : (
              activeCampaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => {
                    onSelectCampaign(campaign);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                    selectedCampaign?.id === campaign.id
                      ? "bg-secondary-container text-on-secondary-container"
                      : "hover:bg-surface-container-high"
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      campaign.is_active ? "bg-success" : "bg-outline"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{campaign.name}</p>
                    {campaign.starts_at && (
                      <p className="text-xs text-on-surface-variant">
                        {new Date(campaign.starts_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {selectedCampaign?.id === campaign.id && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
