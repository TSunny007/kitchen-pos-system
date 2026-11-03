"use client";

import { useId, useState } from "react";
import { Campaign, LedgerEntry } from "../../types";
import type { LedgerEntryInput } from "../../lib/supabase";
import {
  MAX_ENTRY_AMOUNT,
  entryKind,
  resolvePerson,
  roundToCents,
  signedAmount,
  type EntryKind,
} from "../../lib/ledger";
import Modal from "../Modal";
import PriceInput from "../terminal/PriceInput";

interface LedgerEntryModalProps {
  /** Every campaign, archived included - a late receipt for a past event is the common case. */
  campaigns: Campaign[];
  /** Present when editing; absent when adding. */
  entry?: LedgerEntry;
  /** Which campaign a new entry starts on. Ignored when editing. */
  defaultCampaignId: number | null;
  /** Names already used on other entries, offered as suggestions. */
  people: string[];
  onClose: () => void;
  onSave: (input: LedgerEntryInput) => Promise<void>;
  /** Only passed when editing. */
  onDelete?: () => Promise<void>;
}

const KINDS: { kind: EntryKind; label: string; hint: string }[] = [
  { kind: "expense", label: "Expense", hint: "Groceries, supplies, fees" },
  { kind: "addition", label: "Addition", hint: "Tips, donations" },
];

const FIELD =
  "w-full rounded-lg border border-outline bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function LedgerEntryModal({
  campaigns,
  entry,
  defaultCampaignId,
  people,
  onClose,
  onSave,
  onDelete,
}: LedgerEntryModalProps) {
  const labelId = useId();
  const personId = useId();
  const peopleListId = useId();
  const campaignId = useId();

  const [kind, setKind] = useState<EntryKind>(entry ? entryKind(entry.amount) : "expense");
  const [label, setLabel] = useState(entry?.label ?? "");
  const [person, setPerson] = useState(entry?.person ?? "");
  const [amount, setAmount] = useState(entry ? String(Math.abs(entry.amount)) : "");
  // "" is "not tied to a campaign": a <select> value is always a string, and
  // an empty one can't collide with a real id.
  const [campaign, setCampaign] = useState(
    String((entry ? entry.campaign_id : defaultCampaignId) ?? "")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = campaigns.filter((c) => c.is_active);
  const archived = campaigns.filter((c) => !c.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError("Please enter a description");
      return;
    }

    // Rounded first, because the column stores hundredths: "0.004" is positive
    // but would be stored as 0.00 and rejected by the database with a message
    // nobody can act on.
    const magnitude = roundToCents(parseFloat(amount));
    if (!(magnitude > 0)) {
      setError("Please enter an amount greater than zero");
      return;
    }
    if (magnitude > MAX_ENTRY_AMOUNT) {
      setError("That amount is too large");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        campaign_id: campaign === "" ? null : Number(campaign),
        label: label.trim(),
        person: resolvePerson(person, people),
        amount: signedAmount(kind, magnitude),
      });
      onClose(); // unmounts, discarding form state
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !confirm("Delete this entry?")) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={entry ? "Edit Entry" : "Add Entry"}
      panelClassName="max-h-[90vh] max-w-md overflow-y-auto"
    >
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Expense / Addition */}
          <div role="group" aria-label="Type" className="grid grid-cols-2 gap-2">
            {KINDS.map((option) => (
              <button
                key={option.kind}
                type="button"
                onClick={() => setKind(option.kind)}
                aria-pressed={kind === option.kind}
                disabled={isSubmitting}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  kind === option.kind
                    ? "border-primary bg-primary-container text-on-primary-container"
                    : "border-outline-variant bg-surface-container text-on-surface hover:border-outline hover:bg-surface-container-high"
                }`}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs opacity-70">{option.hint}</span>
              </button>
            ))}
          </div>

          <div>
            <label htmlFor={labelId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Description *
            </label>
            <input
              id={labelId}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={kind === "expense" ? "e.g., Groceries" : "e.g., Tips"}
              className={FIELD}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-on-surface">Amount *</span>
            <PriceInput
              value={amount}
              onChange={setAmount}
              disabled={isSubmitting}
              className="bg-surface"
              aria-label="Amount"
            />
          </div>

          <div>
            <label htmlFor={personId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Person
            </label>
            {/* A native datalist: type a new name or pick one already used. */}
            <input
              id={personId}
              type="text"
              list={peopleListId}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
              className={FIELD}
              disabled={isSubmitting}
            />
            <datalist id={peopleListId}>
              {people.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor={campaignId} className="mb-1.5 block text-sm font-medium text-on-surface">
              Campaign
            </label>
            <select
              id={campaignId}
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className={FIELD}
              disabled={isSubmitting}
            >
              <option value="">Not tied to a campaign</option>
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {archived.length > 0 && (
                <optgroup label="Archived">
                  {archived.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {campaign === "" && (
              <p className="mt-1.5 text-xs text-on-surface-variant">
                Counts toward the organisation total, but not any one campaign&apos;s net.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-outline py-3 font-medium text-on-surface transition-colors hover:bg-surface-container"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full bg-primary py-3 font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : entry ? "Save" : "Add Entry"}
            </button>
          </div>

          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="w-full rounded-full py-3 font-medium text-error transition-colors hover:bg-error-container disabled:opacity-50"
            >
              Delete entry
            </button>
          )}
        </form>
      </div>
    </Modal>
  );
}
