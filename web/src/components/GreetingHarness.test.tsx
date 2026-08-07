import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { GreetingClient } from "@/api"
import { GreetingHarness } from "@/components/GreetingHarness"

function mockClient(
  fetchGreeting: GreetingClient["fetchGreeting"],
): GreetingClient {
  return { fetchGreeting } as GreetingClient
}

describe("GreetingHarness", () => {
  it("shows the greeting on success", async () => {
    const user = userEvent.setup()
    const fetchGreeting = vi
      .fn()
      .mockResolvedValue("Hello, Web, from a Spring Modulith module.")

    render(<GreetingHarness client={mockClient(fetchGreeting)} />)

    await user.click(screen.getByRole("button", { name: "Fetch greeting" }))

    expect(
      await screen.findByText("Hello, Web, from a Spring Modulith module."),
    ).toBeInTheDocument()
    expect(fetchGreeting).toHaveBeenCalledWith("Web")
  })

  it("shows an error when the client fails", async () => {
    const user = userEvent.setup()
    const fetchGreeting = vi.fn().mockRejectedValue(new Error("network down"))

    render(<GreetingHarness client={mockClient(fetchGreeting)} />)

    await user.click(screen.getByRole("button", { name: "Fetch greeting" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("network down")
  })

  it("shows a loading state while the request is in flight", async () => {
    const user = userEvent.setup()
    let resolveGreeting!: (value: string) => void
    const fetchGreeting = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveGreeting = resolve
        }),
    )

    render(<GreetingHarness client={mockClient(fetchGreeting)} />)

    await user.click(screen.getByRole("button", { name: "Fetch greeting" }))

    expect(screen.getByRole("status")).toHaveTextContent("Loading…")
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled()

    resolveGreeting("done")
    expect(await screen.findByText("done")).toBeInTheDocument()
  })
})
