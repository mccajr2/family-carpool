import { useState } from "react"

import { GreetingClient } from "@/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type HarnessStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }

type GreetingHarnessProps = {
  client?: GreetingClient
  initialName?: string
}

export function GreetingHarness({
  client = new GreetingClient(),
  initialName = "Web",
}: GreetingHarnessProps) {
  const [name, setName] = useState(initialName)
  const [status, setStatus] = useState<HarnessStatus>({ kind: "idle" })

  async function onFetch() {
    setStatus({ kind: "loading" })
    try {
      const message = await client.fetchGreeting(name.trim() || "Web")
      setStatus({ kind: "success", message })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong"
      setStatus({ kind: "error", message })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>quickapp</CardTitle>
        <CardDescription>
          Disposable web harness — same greeting contract as mobile.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            disabled={status.kind === "loading"}
          />
          <Button
            type="button"
            onClick={() => void onFetch()}
            disabled={status.kind === "loading"}
          >
            {status.kind === "loading" ? "Loading…" : "Fetch greeting"}
          </Button>
        </div>

        {status.kind === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        ) : null}

        {status.kind === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {status.message}
          </p>
        ) : null}

        {status.kind === "success" ? (
          <p role="status" className="text-sm text-foreground">
            {status.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
