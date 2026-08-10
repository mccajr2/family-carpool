import { useEffect, useState } from "react"

import type { AuthClient } from "@/api/authClient"
import type { AuthSessionHolder } from "@/api/authSession"
import { FamilyClient } from "@/api/familyClient"
import { isPlaceLocated, type ActivityFeed, type Adult, type FamilyCircle, type FamilyMember, type Kid, type Place, feedSyncStatusLabel } from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }

type EmptyMode = "choose" | "create" | "join"

type FamilyScreenProps = {
  session: AuthSessionHolder
  authClient?: AuthClient
  familyClient?: FamilyClient
  onSignedOut: () => void
}

function circleTitle(circle: FamilyCircle): string {
  return circle.name?.trim() ? circle.name : "Your family"
}

function memberLabel(member: FamilyMember): string {
  return member.displayName?.trim() ? member.displayName : member.email
}

export function FamilyScreen({
  session,
  authClient,
  familyClient: familyClientProp,
  onSignedOut,
}: FamilyScreenProps) {
  // Default param `new FamilyClient()` would be a new instance every render and
  // retrigger the load effect forever (frozen "Loading…" / create form).
  const [familyClient] = useState(() => familyClientProp ?? new FamilyClient())
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const [circle, setCircle] = useState<FamilyCircle | null>(null)
  const [adult, setAdult] = useState<Adult | null>(() => session.getAdult())
  const [emptyMode, setEmptyMode] = useState<EmptyMode>("choose")
  const [adultDisplayName, setAdultDisplayName] = useState("")
  const [circleName, setCircleName] = useState("")
  const [inviteCodeInput, setInviteCodeInput] = useState("")
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [newKidName, setNewKidName] = useState("")
  const [editingKidId, setEditingKidId] = useState<string | null>(null)
  const [editingKidName, setEditingKidName] = useState("")
  const [newPlaceName, setNewPlaceName] = useState("")
  const [newPlaceAddress, setNewPlaceAddress] = useState("")
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null)
  const [editingPlaceName, setEditingPlaceName] = useState("")
  const [editingPlaceAddress, setEditingPlaceAddress] = useState("")
  const [feeds, setFeeds] = useState<ActivityFeed[]>([])
  const [newFeedName, setNewFeedName] = useState("")
  const [newFeedUrl, setNewFeedUrl] = useState("")
  const [newFeedKidIds, setNewFeedKidIds] = useState<string[]>([])
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null)
  const [editingFeedName, setEditingFeedName] = useState("")
  const [editingFeedUrl, setEditingFeedUrl] = useState("")
  const [editingFeedKidIds, setEditingFeedKidIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = session.getAccessToken()
      if (!token) {
        setStatus({ kind: "error", message: "Not signed in" })
        return
      }
      setStatus({ kind: "loading" })
      try {
        const loaded = await familyClient.getCircle(token)
        if (cancelled) {
          return
        }
        setCircle(loaded)
        if (loaded?.role === "ORGANIZER") {
          try {
            const invite = await familyClient.getInvite(token)
            if (!cancelled) {
              setInviteCode(invite.code)
            }
          } catch {
            if (!cancelled) {
              setInviteCode(null)
            }
          }
          try {
            const loadedFeeds = await familyClient.listFeeds(token)
            if (!cancelled) {
              setFeeds(loadedFeeds)
            }
          } catch {
            if (!cancelled) {
              setFeeds([])
            }
          }
        } else {
          setInviteCode(null)
          setFeeds([])
        }
        setStatus({ kind: "idle" })
      } catch (error) {
        if (cancelled) {
          return
        }
        setStatus({
          kind: "error",
          message: error instanceof Error ? error.message : "Something went wrong",
        })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [familyClient, session])

  async function requireToken(): Promise<string> {
    const token = session.getAccessToken()
    if (!token) {
      throw new Error("Not signed in")
    }
    return token
  }

  async function refreshAdult(token: string) {
    if (!authClient) {
      return
    }
    const me = await authClient.getMe(token)
    session.setSession(token, me)
    setAdult(me)
  }

  async function onCreateCircle() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const created = await familyClient.createCircle(token, {
        adultDisplayName: adultDisplayName.trim(),
        name: circleName.trim() ? circleName.trim() : null,
      })
      setCircle(created)
      setFeeds([])
      const invite = await familyClient.getInvite(token)
      setInviteCode(invite.code)
      await refreshAdult(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onJoinCircle() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const joined = await familyClient.joinCircle(token, {
        code: inviteCodeInput.trim(),
        adultDisplayName: adultDisplayName.trim() ? adultDisplayName.trim() : null,
      })
      setCircle(joined)
      setInviteCode(null)
      setFeeds([])
      await refreshAdult(token)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRegenerateInvite() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const invite = await familyClient.regenerateInvite(token)
      setInviteCode(invite.code)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onLeaveCircle() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.leaveCircle(token)
      setCircle(null)
      setInviteCode(null)
      setFeeds([])
      setEmptyMode("choose")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onUpdateMemberRole(member: FamilyMember, role: "ORGANIZER" | "CAREGIVER") {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.updateMemberRole(token, member.adultId, role)
      setCircle(updated)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemoveMember(member: FamilyMember) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.removeMember(token, member.adultId)
      setCircle((current) =>
        current
          ? {
              ...current,
              members: current.members.filter((item) => item.adultId !== member.adultId),
            }
          : current,
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onAddKid() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const kid = await familyClient.addKid(token, newKidName.trim())
      setCircle((current) =>
        current ? { ...current, kids: [...current.kids, kid] } : current,
      )
      setNewKidName("")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSaveKid(kid: Kid) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.updateKid(token, kid.id, editingKidName.trim())
      setCircle((current) =>
        current
          ? {
              ...current,
              kids: current.kids.map((item) => (item.id === kid.id ? updated : item)),
            }
          : current,
      )
      setEditingKidId(null)
      setEditingKidName("")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemoveKid(kidId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.deleteKid(token, kidId)
      setCircle((current) =>
        current
          ? { ...current, kids: current.kids.filter((kid) => kid.id !== kidId) }
          : current,
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onAddPlace() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const place = await familyClient.addPlace(
        token,
        newPlaceName.trim(),
        newPlaceAddress.trim(),
      )
      setCircle((current) =>
        current ? { ...current, places: [...current.places, place] } : current,
      )
      setNewPlaceName("")
      setNewPlaceAddress("")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSavePlace(place: Place) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.updatePlace(
        token,
        place.id,
        editingPlaceName.trim(),
        editingPlaceAddress.trim(),
      )
      setCircle((current) =>
        current
          ? {
              ...current,
              places: current.places.map((item) =>
                item.id === place.id ? updated : item,
              ),
            }
          : current,
      )
      setEditingPlaceId(null)
      setEditingPlaceName("")
      setEditingPlaceAddress("")
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemovePlace(placeId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.deletePlace(token, placeId)
      setCircle((current) =>
        current
          ? {
              ...current,
              places: current.places.filter((place) => place.id !== placeId),
            }
          : current,
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onLocatePlace(placeId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.locatePlace(token, placeId)
      setCircle((current) =>
        current
          ? {
              ...current,
              places: current.places.map((place) =>
                place.id === placeId ? updated : place,
              ),
            }
          : current,
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  function toggleKidId(
    kidId: string,
    selected: string[],
    setSelected: (next: string[]) => void,
  ) {
    setSelected(
      selected.includes(kidId)
        ? selected.filter((id) => id !== kidId)
        : [...selected, kidId],
    )
  }

  async function onAddFeed() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const feed = await familyClient.createFeed(
        token,
        newFeedName.trim(),
        newFeedUrl.trim(),
        newFeedKidIds,
      )
      setFeeds((current) => [...current, feed])
      setNewFeedName("")
      setNewFeedUrl("")
      setNewFeedKidIds([])
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSaveFeed(feed: ActivityFeed) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.updateFeed(
        token,
        feed.id,
        editingFeedName.trim(),
        editingFeedUrl.trim(),
        editingFeedKidIds,
      )
      setFeeds((current) =>
        current.map((item) => (item.id === feed.id ? updated : item)),
      )
      setEditingFeedId(null)
      setEditingFeedName("")
      setEditingFeedUrl("")
      setEditingFeedKidIds([])
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onRemoveFeed(feedId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      await familyClient.deleteFeed(token, feedId)
      setFeeds((current) => current.filter((feed) => feed.id !== feedId))
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSyncFeed(feedId: string) {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const updated = await familyClient.syncFeed(token, feedId)
      setFeeds((current) =>
        current.map((feed) => (feed.id === feedId ? updated : feed)),
      )
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onSignOut() {
    setStatus({ kind: "loading" })
    const token = session.getAccessToken()
    try {
      if (token && authClient) {
        await authClient.logout(token)
      }
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
      return
    }
    session.clear()
    onSignedOut()
  }

  if (!circle && status.kind === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your family</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!circle) {
    const needsName = !adult?.displayName
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {emptyMode === "join"
              ? "Join a family"
              : emptyMode === "create"
                ? "Create your family"
                : "Your family"}
          </CardTitle>
          <CardDescription>
            Signed in as {adult?.email ?? "unknown"}. Create a circle or join with
            an invite code.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {emptyMode === "choose" ? (
            <>
              <Button
                type="button"
                onClick={() => {
                  setEmptyMode("create")
                  setStatus({ kind: "idle" })
                }}
                disabled={status.kind === "loading"}
              >
                Create family
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEmptyMode("join")
                  setStatus({ kind: "idle" })
                }}
                disabled={status.kind === "loading"}
              >
                Have an invite code?
              </Button>
            </>
          ) : null}

          {emptyMode === "create" ? (
            <>
              <Input
                aria-label="Your name"
                value={adultDisplayName}
                onChange={(event) => setAdultDisplayName(event.target.value)}
                placeholder="Your name"
                disabled={status.kind === "loading"}
              />
              <Input
                aria-label="Your family (optional)"
                value={circleName}
                onChange={(event) => setCircleName(event.target.value)}
                placeholder="Your family"
                disabled={status.kind === "loading"}
              />
              <Button
                type="button"
                onClick={() => void onCreateCircle()}
                disabled={status.kind === "loading" || !adultDisplayName.trim()}
              >
                {status.kind === "loading" ? "Creating…" : "Create family"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmptyMode("choose")}
                disabled={status.kind === "loading"}
              >
                Back
              </Button>
            </>
          ) : null}

          {emptyMode === "join" ? (
            <>
              <Input
                aria-label="Invite code"
                value={inviteCodeInput}
                onChange={(event) => setInviteCodeInput(event.target.value)}
                placeholder="Invite code"
                disabled={status.kind === "loading"}
              />
              {needsName ? (
                <Input
                  aria-label="Your name"
                  value={adultDisplayName}
                  onChange={(event) => setAdultDisplayName(event.target.value)}
                  placeholder="Your name"
                  disabled={status.kind === "loading"}
                />
              ) : null}
              <Button
                type="button"
                onClick={() => void onJoinCircle()}
                disabled={
                  status.kind === "loading" ||
                  !inviteCodeInput.trim() ||
                  (needsName && !adultDisplayName.trim())
                }
              >
                {status.kind === "loading" ? "Joining…" : "Join family"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmptyMode("choose")}
                disabled={status.kind === "loading"}
              >
                Back
              </Button>
            </>
          ) : null}

          {status.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => void onSignOut()}
            disabled={status.kind === "loading"}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isOrganizer = circle.role === "ORGANIZER"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{circleTitle(circle)}</CardTitle>
        <CardDescription>
          {adult?.displayName ? `${adult.displayName} · ` : null}
          {adult?.email} · {circle.role}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isOrganizer && inviteCode ? (
          <section aria-label="Invite code" className="flex flex-col gap-2">
            <p className="text-sm">
              Invite code: <span className="font-mono">{inviteCode}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onRegenerateInvite()}
              disabled={status.kind === "loading"}
            >
              Regenerate code
            </Button>
          </section>
        ) : null}

        <section aria-label="Members" className="flex flex-col gap-3">
          <p className="text-sm font-medium">Members</p>
          <ul className="flex flex-col gap-2">
            {circle.members.map((member) => {
              const isSelf = member.adultId === adult?.id
              return (
                <li
                  key={member.adultId}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <span className="flex-1 text-sm">
                    {memberLabel(member)} · {member.role}
                    {isSelf ? " (you)" : ""}
                  </span>
                  {isOrganizer && !isSelf ? (
                    <>
                      {member.role === "CAREGIVER" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onUpdateMemberRole(member, "ORGANIZER")}
                          disabled={status.kind === "loading"}
                        >
                          Promote
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onUpdateMemberRole(member, "CAREGIVER")}
                          disabled={status.kind === "loading"}
                        >
                          Demote
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onRemoveMember(member)}
                        disabled={status.kind === "loading"}
                      >
                        Remove
                      </Button>
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-label="Kids" className="flex flex-col gap-3">
          {circle.kids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No kids yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {circle.kids.map((kid) => (
                <li key={kid.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {isOrganizer && editingKidId === kid.id ? (
                    <>
                      <Input
                        aria-label={`Rename ${kid.displayName}`}
                        value={editingKidName}
                        onChange={(event) => setEditingKidName(event.target.value)}
                        disabled={status.kind === "loading"}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void onSaveKid(kid)}
                        disabled={status.kind === "loading" || !editingKidName.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingKidId(null)
                          setEditingKidName("")
                        }}
                        disabled={status.kind === "loading"}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{kid.displayName}</span>
                      {isOrganizer ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingKidId(kid.id)
                              setEditingKidName(kid.displayName)
                            }}
                            disabled={status.kind === "loading"}
                          >
                            Rename
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void onRemoveKid(kid.id)}
                            disabled={status.kind === "loading"}
                          >
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isOrganizer ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="New kid name"
              value={newKidName}
              onChange={(event) => setNewKidName(event.target.value)}
              placeholder="Kid display name"
              disabled={status.kind === "loading"}
            />
            <Button
              type="button"
              onClick={() => void onAddKid()}
              disabled={status.kind === "loading" || !newKidName.trim()}
            >
              Add kid
            </Button>
          </div>
        ) : null}

        <section aria-label="Places" className="flex flex-col gap-3">
          <p className="text-sm font-medium">Places</p>
          {circle.places.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {circle.places.map((place) => (
                <li key={place.id} className="flex flex-col gap-2">
                  {editingPlaceId === place.id ? (
                    <>
                      <Input
                        aria-label={`Rename place ${place.name}`}
                        value={editingPlaceName}
                        onChange={(event) => setEditingPlaceName(event.target.value)}
                        disabled={status.kind === "loading"}
                      />
                      <Input
                        aria-label={`Edit address for ${place.name}`}
                        value={editingPlaceAddress}
                        onChange={(event) => setEditingPlaceAddress(event.target.value)}
                        disabled={status.kind === "loading"}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void onSavePlace(place)}
                          disabled={
                            status.kind === "loading" ||
                            !editingPlaceName.trim() ||
                            !editingPlaceAddress.trim()
                          }
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingPlaceId(null)
                            setEditingPlaceName("")
                            setEditingPlaceAddress("")
                          }}
                          disabled={status.kind === "loading"}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="flex-1 text-sm">
                        {place.name}
                        <span className="block text-muted-foreground">{place.address}</span>
                        <span className="block text-xs text-muted-foreground">
                          {isPlaceLocated(place) ? "Located" : "Not located"}
                        </span>
                      </span>
                      {!isPlaceLocated(place) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onLocatePlace(place.id)}
                          disabled={status.kind === "loading"}
                        >
                          Retry locate
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingPlaceId(place.id)
                          setEditingPlaceName(place.name)
                          setEditingPlaceAddress(place.address)
                        }}
                        disabled={status.kind === "loading"}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onRemovePlace(place.id)}
                        disabled={status.kind === "loading"}
                      >
                        Remove place
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <Input
            aria-label="New place name"
            value={newPlaceName}
            onChange={(event) => setNewPlaceName(event.target.value)}
            placeholder="Place name (e.g. Mom's house)"
            disabled={status.kind === "loading"}
          />
          <Input
            aria-label="New place address"
            value={newPlaceAddress}
            onChange={(event) => setNewPlaceAddress(event.target.value)}
            placeholder="Address"
            disabled={status.kind === "loading"}
          />
          <Button
            type="button"
            onClick={() => void onAddPlace()}
            disabled={
              status.kind === "loading" ||
              !newPlaceName.trim() ||
              !newPlaceAddress.trim()
            }
          >
            Add place
          </Button>
        </div>

        {isOrganizer ? (
          <section aria-label="Activity feeds" className="flex flex-col gap-3">
            <p className="text-sm font-medium">Activity feeds</p>
            {feeds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feeds yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {feeds.map((feed) => (
                  <li key={feed.id} className="flex flex-col gap-2">
                    {editingFeedId === feed.id ? (
                      <>
                        <Input
                          aria-label={`Rename feed ${feed.name}`}
                          value={editingFeedName}
                          onChange={(event) => setEditingFeedName(event.target.value)}
                          disabled={status.kind === "loading"}
                        />
                        <Input
                          aria-label={`Edit URL for ${feed.name}`}
                          value={editingFeedUrl}
                          onChange={(event) => setEditingFeedUrl(event.target.value)}
                          disabled={status.kind === "loading"}
                        />
                        {circle.kids.length > 0 ? (
                          <fieldset className="flex flex-col gap-1">
                            <legend className="text-xs text-muted-foreground">Kids on feed</legend>
                            {circle.kids.map((kid) => (
                              <label
                                key={kid.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`Assign ${kid.displayName} to ${feed.name}`}
                                  checked={editingFeedKidIds.includes(kid.id)}
                                  onChange={() =>
                                    toggleKidId(
                                      kid.id,
                                      editingFeedKidIds,
                                      setEditingFeedKidIds,
                                    )
                                  }
                                  disabled={status.kind === "loading"}
                                />
                                {kid.displayName}
                              </label>
                            ))}
                          </fieldset>
                        ) : null}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void onSaveFeed(feed)}
                            disabled={
                              status.kind === "loading" ||
                              !editingFeedName.trim() ||
                              !editingFeedUrl.trim()
                            }
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingFeedId(null)
                              setEditingFeedName("")
                              setEditingFeedUrl("")
                              setEditingFeedKidIds([])
                            }}
                            disabled={status.kind === "loading"}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className="flex-1 text-sm">
                          {feed.name}
                          <span className="block text-muted-foreground">{feed.sourceUrl}</span>
                          <span className="block text-xs text-muted-foreground">
                            {feedSyncStatusLabel(feed)}
                          </span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onSyncFeed(feed.id)}
                          disabled={status.kind === "loading"}
                        >
                          Sync now
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingFeedId(feed.id)
                            setEditingFeedName(feed.name)
                            setEditingFeedUrl(feed.sourceUrl)
                            setEditingFeedKidIds([...feed.kidIds])
                          }}
                          disabled={status.kind === "loading"}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onRemoveFeed(feed.id)}
                          disabled={status.kind === "loading"}
                        >
                          Remove feed
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2">
              <Input
                aria-label="New feed name"
                value={newFeedName}
                onChange={(event) => setNewFeedName(event.target.value)}
                placeholder="Feed name (e.g. U12 Travel)"
                disabled={status.kind === "loading"}
              />
              <Input
                aria-label="New feed URL"
                value={newFeedUrl}
                onChange={(event) => setNewFeedUrl(event.target.value)}
                placeholder="iCal or webcal URL"
                disabled={status.kind === "loading"}
              />
              {circle.kids.length > 0 ? (
                <fieldset className="flex flex-col gap-1">
                  <legend className="text-xs text-muted-foreground">Kids on feed</legend>
                  {circle.kids.map((kid) => (
                    <label key={kid.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={`Assign ${kid.displayName} to new feed`}
                        checked={newFeedKidIds.includes(kid.id)}
                        onChange={() =>
                          toggleKidId(kid.id, newFeedKidIds, setNewFeedKidIds)
                        }
                        disabled={status.kind === "loading"}
                      />
                      {kid.displayName}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <Button
                type="button"
                onClick={() => void onAddFeed()}
                disabled={
                  status.kind === "loading" ||
                  !newFeedName.trim() ||
                  !newFeedUrl.trim()
                }
              >
                Add feed
              </Button>
            </div>
          </section>
        ) : null}

        {status.kind === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {status.message}
          </p>
        ) : null}

        <Button
          type="button"
          variant="outline"
          onClick={() => void onLeaveCircle()}
          disabled={status.kind === "loading"}
        >
          Leave family
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => void onSignOut()}
          disabled={status.kind === "loading"}
        >
          {status.kind === "loading" ? "Working…" : "Sign out"}
        </Button>
      </CardContent>
    </Card>
  )
}
