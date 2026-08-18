import type { ReactNode } from "react"

import type { ActivityFeed, Kid } from "@/api/types"
import { feedSyncStatusLabel } from "@/api/types"
import { eventKidNames } from "@/components/coverageDisplay"

export const feedQuietButtonClass =
  "rounded-[var(--fc-radius-md)] border border-[var(--fc-border)] bg-transparent px-[var(--fc-space-feed-action-pad-x)] py-[var(--fc-space-feed-action-pad-y)] text-[length:var(--fc-font-feed-action-size)] leading-[var(--fc-font-feed-action-line)] font-[number:var(--fc-font-feed-action-weight)] text-[var(--fc-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"

export const feedRemoveButtonClass =
  "rounded-[var(--fc-radius-md)] border border-transparent bg-transparent px-[var(--fc-space-feed-action-pad-x)] py-[var(--fc-space-feed-action-pad-y)] text-[length:var(--fc-font-feed-action-size)] leading-[var(--fc-font-feed-action-line)] font-[number:var(--fc-font-feed-action-weight)] text-[var(--fc-text-secondary)] hover:text-[var(--fc-danger)] disabled:cursor-not-allowed disabled:opacity-50"

export const feedSectionLabelClass =
  "mb-[var(--fc-space-feed-section-gap)] text-[length:var(--fc-font-feed-section-label-size)] leading-[var(--fc-font-feed-section-label-line)] font-[number:var(--fc-font-feed-section-label-weight)] uppercase text-[var(--fc-text-secondary)]"

export const feedFormCardClass =
  "rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] p-[var(--fc-space-feed-form-pad)]"

export const feedFieldLabelClass =
  "mb-[var(--fc-space-feed-field-label-gap)] block text-[length:var(--fc-font-feed-field-label-size)] leading-[var(--fc-font-feed-field-label-line)] font-[number:var(--fc-font-feed-field-label-weight)] text-[var(--fc-text-secondary)]"

export const feedInputClass =
  "w-full rounded-[var(--fc-radius-md)] border border-[var(--fc-border)] bg-[var(--fc-surface)] px-[var(--fc-space-feed-input-pad-x)] py-[var(--fc-space-feed-input-pad-y)] text-[length:var(--fc-font-feed-input-size)] leading-[var(--fc-font-feed-input-line)] font-[number:var(--fc-font-feed-input-weight)] text-[var(--fc-text-primary)] placeholder:text-[var(--fc-text-secondary)] focus:border-[var(--fc-accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--fc-accent)_25%,transparent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"

export const feedKidChipClass =
  "inline-flex items-center gap-[var(--fc-space-feed-kid-chip-gap)] rounded-full border border-[var(--fc-border)] px-[var(--fc-space-feed-kid-chip-pad-x)] py-[var(--fc-space-feed-kid-chip-pad-y)] text-[length:var(--fc-font-feed-kid-chip-size)] leading-[var(--fc-font-feed-kid-chip-line)] font-[number:var(--fc-font-feed-kid-chip-weight)] text-[var(--fc-text-secondary)]"

export const feedAccentButtonClass =
  "rounded-[var(--fc-radius-md)] bg-[var(--fc-accent)] px-[var(--fc-space-feed-action-pad-x)] py-[var(--fc-space-feed-submit-pad-y)] text-[length:var(--fc-font-feed-submit-size)] leading-[var(--fc-font-feed-submit-line)] font-[number:var(--fc-font-feed-submit-weight)] text-[var(--fc-accent-on)] disabled:cursor-not-allowed disabled:opacity-50"

export const feedSubmitClass = `mt-[var(--fc-space-feed-submit-margin-top)] w-full ${feedAccentButtonClass}`

export function feedMetaLabel(feed: ActivityFeed, kids: Kid[]): string {
  const kidsLabel = eventKidNames(feed.kidIds, kids)
  const syncLabel = feedSyncStatusLabel(feed)
  return kidsLabel ? `${kidsLabel} · ${syncLabel}` : syncLabel
}

type FeedCardProps = {
  feed: ActivityFeed
  kids: Kid[]
  editing: boolean
  editingName: string
  editingUrl: string
  editingKidIds: string[]
  loading: boolean
  carpoolStatus?: ReactNode
  carpoolCta?: ReactNode
  onEditingNameChange: (value: string) => void
  onEditingUrlChange: (value: string) => void
  onToggleEditingKid: (kidId: string) => void
  onSync: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onRemove: () => void
}

export function FeedCard({
  feed,
  kids,
  editing,
  editingName,
  editingUrl,
  editingKidIds,
  loading,
  carpoolStatus,
  carpoolCta,
  onEditingNameChange,
  onEditingUrlChange,
  onToggleEditingKid,
  onSync,
  onStartEdit,
  onCancelEdit,
  onSave,
  onRemove,
}: FeedCardProps) {
  return (
    <article
      className="rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] px-[var(--fc-space-feed-card-pad-x)] py-[var(--fc-space-feed-card-pad-y)]"
      data-testid="feed-card"
    >
      {editing ? (
        <div className="flex flex-col gap-[var(--fc-space-feed-section-gap)]">
          <div>
            <label className={feedFieldLabelClass} htmlFor={`feed-name-${feed.id}`}>
              Feed name
            </label>
            <input
              id={`feed-name-${feed.id}`}
              className={feedInputClass}
              aria-label={`Rename feed ${feed.name}`}
              value={editingName}
              onChange={(event) => onEditingNameChange(event.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className={feedFieldLabelClass} htmlFor={`feed-url-${feed.id}`}>
              iCal or webcal URL
            </label>
            <input
              id={`feed-url-${feed.id}`}
              className={feedInputClass}
              aria-label={`Edit URL for ${feed.name}`}
              value={editingUrl}
              onChange={(event) => onEditingUrlChange(event.target.value)}
              disabled={loading}
            />
          </div>
          {kids.length > 0 ? (
            <fieldset>
              <legend className={feedFieldLabelClass}>Kids on feed</legend>
              <div className="flex flex-wrap gap-[var(--fc-space-feed-kid-chips-gap)]">
                {kids.map((kid) => (
                  <label key={kid.id} className={feedKidChipClass}>
                    <input
                      type="checkbox"
                      aria-label={`Assign ${kid.displayName} to ${feed.name}`}
                      checked={editingKidIds.includes(kid.id)}
                      onChange={() => onToggleEditingKid(kid.id)}
                      disabled={loading}
                    />
                    {kid.displayName}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="flex flex-wrap gap-[var(--fc-space-feed-quiet-gap)]">
            <button
              type="button"
              className={feedAccentButtonClass}
              onClick={onSave}
              disabled={loading || !editingName.trim() || !editingUrl.trim()}
            >
              Save
            </button>
            <button
              type="button"
              className={feedQuietButtonClass}
              onClick={onCancelEdit}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-[var(--fc-space-feed-actions-gap)]">
            <div>
              <h2 className="fc-display text-[length:var(--fc-font-feed-name-size)] leading-[var(--fc-font-feed-name-line)] font-[number:var(--fc-font-feed-name-weight)] text-[var(--fc-text-primary)]">
                {feed.name}
              </h2>
              <p className="mt-[var(--fc-space-feed-meta-gap)] text-[length:var(--fc-font-feed-meta-size)] leading-[var(--fc-font-feed-meta-line)] font-[number:var(--fc-font-feed-meta-weight)] text-[var(--fc-text-secondary)]">
                {feedMetaLabel(feed, kids)}
              </p>
            </div>
            {carpoolStatus}
          </div>
          <div className="mt-[var(--fc-space-feed-actions-gap)] flex items-center justify-between border-t border-[var(--fc-border)] pt-[var(--fc-space-feed-actions-pad-top)]">
            <div className="flex flex-wrap gap-[var(--fc-space-feed-quiet-gap)]">
              <button
                type="button"
                className={feedQuietButtonClass}
                onClick={onSync}
                disabled={loading}
              >
                Sync now
              </button>
              <button
                type="button"
                className={feedQuietButtonClass}
                onClick={onStartEdit}
                disabled={loading}
              >
                Edit
              </button>
            </div>
            <div className="flex items-center gap-[var(--fc-space-feed-cta-gap)]">
              {carpoolCta}
              <button
                type="button"
                className={feedRemoveButtonClass}
                onClick={onRemove}
                disabled={loading}
              >
                Remove
              </button>
            </div>
          </div>
        </>
      )}
    </article>
  )
}
