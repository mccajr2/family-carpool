import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { AuthClient } from "@/api/authClient"
import { AuthSessionHolder } from "@/api/authSession"
import type { FamilyClient } from "@/api/familyClient"
import { AuthScreen } from "@/components/AuthScreen"

function mockClient(partial: Partial<AuthClient>): AuthClient {
  return partial as AuthClient
}

function mockFamilyClient(partial: Partial<FamilyClient>): FamilyClient {
  return partial as FamilyClient
}

describe("AuthScreen", () => {
  it("requests a code then signs in and can sign out", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    const requestCode = vi.fn().mockResolvedValue({
      email: "parent@example.com",
      expiresInSeconds: 600,
      devCode: "654321",
    })
    const verifyCode = vi.fn().mockResolvedValue({
      accessToken: "tok",
      tokenType: "Bearer",
      adult: { id: "1", email: "parent@example.com", displayName: null },
    })
    const logout = vi.fn().mockResolvedValue(undefined)
    const getCircle = vi.fn().mockResolvedValue(null)

    render(
      <AuthScreen
        client={mockClient({ requestCode, verifyCode, logout })}
        familyClient={mockFamilyClient({ getCircle })}
        session={session}
      />,
    )

    expect(screen.getByRole("heading", { name: "Sign in" }).closest("[class*='max-w-5xl']")).not.toBeNull()

    await user.type(screen.getByLabelText("Email"), "parent@example.com")
    await user.click(screen.getByRole("button", { name: "Send code" }))

    expect(await screen.findByLabelText("One-time code")).toHaveValue("654321")
    await user.click(screen.getByRole("button", { name: "Verify code" }))

    expect(session.getAccessToken()).toBe("tok")
    expect(await screen.findByRole("button", { name: "Create family" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create family" }).closest("[class*='max-w-5xl']")).not.toBeNull()
    expect(screen.getByText(/parent@example.com/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Sign out" }))
    expect(await screen.findByRole("button", { name: "Send code" })).toBeInTheDocument()
    expect(session.isSignedIn()).toBe(false)
    expect(logout).toHaveBeenCalledWith("tok")
  })

  it("shows an error when request code fails", async () => {
    const user = userEvent.setup()
    const requestCode = vi.fn().mockRejectedValue(new Error("network down"))

    render(
      <AuthScreen
        client={mockClient({ requestCode })}
        session={new AuthSessionHolder()}
      />,
    )

    await user.type(screen.getByLabelText("Email"), "parent@example.com")
    await user.click(screen.getByRole("button", { name: "Send code" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("network down")
  })
})
