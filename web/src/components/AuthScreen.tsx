import { useState } from "react"

import { AuthClient } from "@/api/authClient"
import { AuthSessionHolder, authSession } from "@/api/authSession"
import { FamilyClient } from "@/api/familyClient"
import type { Adult } from "@/api/types"
import { CenteredColumn } from "@/components/CenteredColumn"
import { FamilyScreen } from "@/components/FamilyScreen"
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
  familyClient?: FamilyClient
  session?: AuthSessionHolder
}

export function AuthScreen({
  client: clientProp,
  familyClient: familyClientProp,
  session = authSession,
}: AuthScreenProps) {
  const [client] = useState(() => clientProp ?? new AuthClient())
  const [familyClient] = useState(
    () => familyClientProp ?? new FamilyClient(),
  )
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

  if (adult) {
    return (
      <FamilyScreen
        session={session}
        authClient={client}
        familyClient={familyClient}
        onSignedOut={() => {
          setAdult(null)
          setCodeSent(false)
          setCode("")
          setDevHint(null)
          setStatus({ kind: "idle" })
        }}
      />
    )
  }

  return (
    <CenteredColumn>
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
    </CenteredColumn>
  )
}
