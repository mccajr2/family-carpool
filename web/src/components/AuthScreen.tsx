import { useState } from "react"

import { AuthClient } from "@/api/authClient"
import { AuthSessionHolder, authSession } from "@/api/authSession"
import type { Adult } from "@/api/types"
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

type AuthScreenProps = {
  client?: AuthClient
  session?: AuthSessionHolder
}

export function AuthScreen({
  client = new AuthClient(),
  session = authSession,
}: AuthScreenProps) {
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [devHint, setDevHint] = useState<string | null>(null)
  const [adult, setAdult] = useState<Adult | null>(() => session.getAdult())
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  async function onRequestCode() {
    setStatus({ kind: "loading" })
    setDevHint(null)
    try {
      const result = await client.requestCode(email.trim())
      setCodeSent(true)
      if (result.devCode) {
        setDevHint(result.devCode)
        setCode(result.devCode)
      }
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onVerifyCode() {
    setStatus({ kind: "loading" })
    try {
      const result = await client.verifyCode(email.trim(), code.trim())
      session.setSession(result.accessToken, result.adult)
      setAdult(result.adult)
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
      if (token) {
        await client.logout(token)
      }
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
      return
    }
    session.clear()
    setAdult(null)
    setCodeSent(false)
    setCode("")
    setDevHint(null)
    setStatus({ kind: "idle" })
  }

  if (adult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
          <CardDescription>Bearer session held in memory for this tab.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p role="status" className="text-sm">
            {adult.email}
          </p>
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
            {status.kind === "loading" ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Email one-time code — same auth contract as Android and iOS.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input
          aria-label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={status.kind === "loading"}
        />

        {codeSent ? (
          <>
            <Input
              aria-label="One-time code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="6-digit code"
              disabled={status.kind === "loading"}
            />
            {devHint ? (
              <p className="text-xs text-muted-foreground">
                Dev code echo: {devHint}
              </p>
            ) : null}
            <Button
              type="button"
              onClick={() => void onVerifyCode()}
              disabled={status.kind === "loading" || !code.trim()}
            >
              {status.kind === "loading" ? "Verifying…" : "Verify code"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={() => void onRequestCode()}
            disabled={status.kind === "loading" || !email.trim()}
          >
            {status.kind === "loading" ? "Sending…" : "Send code"}
          </Button>
        )}

        {status.kind === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Working…
          </p>
        ) : null}

        {status.kind === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {status.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
