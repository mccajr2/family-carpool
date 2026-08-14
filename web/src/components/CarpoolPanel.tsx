import { useCallback, useEffect, useState } from "react"

import type { CarpoolClient } from "@/api/carpoolClient"
import type { CarpoolSummary } from "@/api/types"
import { CarpoolFeedActions } from "@/components/CarpoolFeedActions"
import { circleDisplayName } from "@/components/carpoolDisplay"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string }

type CarpoolPanelProps = {
  accessToken: string
  carpoolClient: CarpoolClient
  onJoined?: () => void | Promise<void>
}

export function CarpoolPanel({
  accessToken,
  carpoolClient,
  onJoined,
}: CarpoolPanelProps) {
  const [summary, setSummary] = useState<CarpoolSummary | null>(null)
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const [codeInput, setCodeInput] = useState("")
  const [showCodeForm, setShowCodeForm] = useState(false)
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setStatus({ kind: "loading" })
    try {
      const next = await carpoolClient.getSummary(accessToken)
      setSummary(next)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }, [accessToken, carpoolClient])

  useEffect(() => {
    void reload()
  }, [reload])

  async function run(action: () => Promise<void>) {
    setStatus({ kind: "loading" })
    try {
      await action()
      const next = await carpoolClient.getSummary(accessToken)
      setSummary(next)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  const isOrganizer = summary?.circleRole === "ORGANIZER"
  const busy = status.kind === "loading"
  const empty =
    summary != null && summary.feeds.length === 0 && summary.spaces.length === 0

  return (
    <section aria-label="Carpool" className="flex flex-col gap-4">
      {summary == null && status.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading carpool…</p>
      ) : null}

      {empty ? (
        <p className="text-sm text-muted-foreground">
          {isOrganizer
            ? "Add a team calendar in Feeds, or paste an invite code."
            : "Paste an invite code to join a team carpool."}
        </p>
      ) : null}

      {summary && summary.feeds.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {summary.feeds.map((feed) => (
            <li key={feed.feedId} className="flex flex-col gap-1">
              <span className="text-sm font-medium">{feed.feedName}</span>
              {feed.spaceName && feed.status !== "NONE" ? (
                <span className="text-xs text-muted-foreground">{feed.spaceName}</span>
              ) : null}
              <CarpoolFeedActions
                feed={feed}
                circleRole={summary.circleRole}
                disabled={busy}
                onEnable={(feedId) => void run(() => carpoolClient.enable(accessToken, feedId).then(() => undefined))}
                onRequest={(spaceId) =>
                  void run(() => carpoolClient.createRequest(accessToken, spaceId).then(() => undefined))
                }
                onOpen={(spaceId) => {
                  setSelectedSpaceId(spaceId)
                  document.getElementById(`carpool-space-${spaceId}`)?.scrollIntoView({
                    block: "nearest",
                  })
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2">
        {showCodeForm ? (
          <>
            <Input
              aria-label="Carpool invite code"
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              placeholder="Invite code"
              disabled={busy}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || !codeInput.trim()}
                onClick={() =>
                  void run(async () => {
                    await carpoolClient.join(accessToken, codeInput.trim())
                    setCodeInput("")
                    setShowCodeForm(false)
                    await onJoined?.()
                  })
                }
              >
                Join
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setShowCodeForm(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setShowCodeForm(true)}
          >
            Have a code?
          </Button>
        )}
      </div>

      {summary && summary.spaces.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Your carpools</p>
          {summary.spaces.map((space) => (
            <article
              key={space.id}
              id={`carpool-space-${space.id}`}
              aria-label={space.name}
              className={`flex flex-col gap-2 rounded-md border p-3 ${
                selectedSpaceId === space.id ? "border-primary" : "border-border"
              }`}
            >
              <div>
                <p className="text-sm font-medium">{space.name}</p>
                <p className="text-xs text-muted-foreground">
                  {space.membership === "OWNER" ? "Owned by this family" : "Member"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Families:{" "}
                {space.members
                  .map((member) => circleDisplayName(member.circleName))
                  .join(", ")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm tracking-wide">{space.inviteCode}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void navigator.clipboard?.writeText(space.inviteCode)}
                >
                  Copy code
                </Button>
                {space.membership === "OWNER" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        carpoolClient.regenerateInvite(accessToken, space.id).then(() => undefined),
                      )
                    }
                  >
                    Regenerate
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(() => carpoolClient.leave(accessToken, space.id))
                  }
                >
                  Leave
                </Button>
              </div>
              {space.membership === "OWNER" && space.pendingRequests.length > 0 ? (
                <ul className="flex flex-col gap-2" aria-label="Pending join requests">
                  {space.pendingRequests.map((request) => (
                    <li key={request.id} className="flex flex-col gap-1">
                      <span className="text-sm">
                        {circleDisplayName(request.circleName)}
                        {request.requestedByDisplayName?.trim()
                          ? ` · requested by ${request.requestedByDisplayName.trim()}`
                          : ""}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              carpoolClient
                                .admit(accessToken, space.id, request.id)
                                .then(() => undefined),
                            )
                          }
                        >
                          Admit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              carpoolClient.decline(accessToken, space.id, request.id),
                            )
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {status.kind === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {status.message}
        </p>
      ) : null}
    </section>
  )
}
