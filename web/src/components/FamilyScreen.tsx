import { useEffect, useState } from "react"

import type { AuthClient } from "@/api/authClient"
import type { AuthSessionHolder } from "@/api/authSession"
import { FamilyClient } from "@/api/familyClient"
import type { Adult, FamilyCircle, Kid } from "@/api/types"
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

type FamilyScreenProps = {
  session: AuthSessionHolder
  authClient?: AuthClient
  familyClient?: FamilyClient
  onSignedOut: () => void
}

function circleTitle(circle: FamilyCircle): string {
  return circle.name?.trim() ? circle.name : "Your family"
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
  const [adultDisplayName, setAdultDisplayName] = useState("")
  const [circleName, setCircleName] = useState("")
  const [newKidName, setNewKidName] = useState("")
  const [editingKidId, setEditingKidId] = useState<string | null>(null)
  const [editingKidName, setEditingKidName] = useState("")

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

  async function onCreateCircle() {
    setStatus({ kind: "loading" })
    try {
      const token = await requireToken()
      const created = await familyClient.createCircle(token, {
        adultDisplayName: adultDisplayName.trim(),
        name: circleName.trim() ? circleName.trim() : null,
      })
      setCircle(created)
      if (authClient) {
        const me = await authClient.getMe(token)
        session.setSession(token, me)
        setAdult(me)
      }
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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create your family</CardTitle>
          <CardDescription>
            Signed in as {adult?.email ?? "unknown"}. Your name is required; family
            name is optional (defaults to “Your family”).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
          {status.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          ) : null}
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
            onClick={() => void onSignOut()}
            disabled={status.kind === "loading"}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    )
  }

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
        <section aria-label="Kids" className="flex flex-col gap-3">
          {circle.kids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No kids yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {circle.kids.map((kid) => (
                <li key={kid.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {editingKidId === kid.id ? (
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
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

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
          {status.kind === "loading" ? "Working…" : "Sign out"}
        </Button>
      </CardContent>
    </Card>
  )
}
