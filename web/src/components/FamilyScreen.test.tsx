import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { AuthClient } from "@/api/authClient"
import { AuthSessionHolder } from "@/api/authSession"
import { FamilyClient } from "@/api/familyClient"
import { FamilyScreen } from "@/components/FamilyScreen"

function mockFamilyClient(partial: Partial<FamilyClient>): FamilyClient {
  return partial as FamilyClient
}

function mockAuthClient(partial: Partial<AuthClient>): AuthClient {
  return partial as AuthClient
}

describe("FamilyScreen", () => {
  it("creates a circle then adds and removes a kid", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: null,
    })

    const getCircle = vi.fn().mockResolvedValue(null)
    const createCircle = vi.fn().mockResolvedValue({
      id: "c1",
      name: null,
      role: "ORGANIZER",
      kids: [],
    })
    const addKid = vi.fn().mockResolvedValue({ id: "k1", displayName: "Sam" })
    const deleteKid = vi.fn().mockResolvedValue(undefined)
    const getMe = vi.fn().mockResolvedValue({
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const logout = vi.fn().mockResolvedValue(undefined)
    const onSignedOut = vi.fn()

    render(
      <FamilyScreen
        session={session}
        authClient={mockAuthClient({ getMe, logout })}
        familyClient={mockFamilyClient({
          getCircle,
          createCircle,
          addKid,
          deleteKid,
        })}
        onSignedOut={onSignedOut}
      />,
    )

    expect(await screen.findByRole("button", { name: "Create family" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Create your family" })).toBeInTheDocument()

    await user.type(screen.getByLabelText("Your name"), "Alex")
    await user.click(screen.getByRole("button", { name: "Create family" }))

    expect(await screen.findByRole("heading", { name: "Your family" })).toBeInTheDocument()
    expect(createCircle).toHaveBeenCalledWith("tok", {
      adultDisplayName: "Alex",
      name: null,
    })
    expect(session.getAdult()?.displayName).toBe("Alex")

    await user.type(screen.getByLabelText("New kid name"), "Sam")
    await user.click(screen.getByRole("button", { name: "Add kid" }))
    expect(await screen.findByText("Sam")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove" }))
    await waitFor(() => {
      expect(screen.queryByText("Sam")).not.toBeInTheDocument()
    })
    expect(deleteKid).toHaveBeenCalledWith("tok", "k1")
  })

  it("shows named circle title when name is set", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue({
            id: "c1",
            name: "McCarthy house",
            role: "ORGANIZER",
            kids: [],
          }),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByRole("heading", { name: "McCarthy house" })).toBeInTheDocument()
  })

  it("loads the circle only once when using the default FamilyClient", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: null,
    })
    const getCircle = vi
      .spyOn(FamilyClient.prototype, "getCircle")
      .mockResolvedValue(null)

    render(<FamilyScreen session={session} onSignedOut={vi.fn()} />)

    expect(await screen.findByRole("button", { name: "Create family" })).toBeInTheDocument()
    await waitFor(() => {
      expect(getCircle).toHaveBeenCalledTimes(1)
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(getCircle).toHaveBeenCalledTimes(1)

    getCircle.mockRestore()
  })
})
