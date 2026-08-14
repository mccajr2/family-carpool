import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { FamilyClient } from "@/api/familyClient"
import type { Garage, Place, Vehicle } from "@/api/types"
import { GaragePanel } from "@/components/GaragePanel"

function mockFamilyClient(partial: Partial<FamilyClient>): FamilyClient {
  return partial as FamilyClient
}

const momHouse: Place = {
  id: "p1",
  name: "Mom's house",
  address: "1 Rd",
  latitude: 40,
  longitude: -74,
}

function vehicle(partial: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "v1",
    ownerAdultId: "1",
    driverAdultIds: ["1"],
    keptAtPlaceId: "p1",
    label: "Blue van",
    year: 2019,
    make: "HONDA",
    model: "Odyssey",
    seats: 8,
    suggestedSeats: 8,
    ...partial,
  }
}

function garage(partial: Partial<Garage> = {}): Garage {
  return {
    members: [
      { adultId: "1", displayName: "Mom", drives: true },
      { adultId: "2", displayName: "Dad", drives: true },
    ],
    vehicles: [],
    ...partial,
  }
}

describe("GaragePanel", () => {
  it("shows loading then empty copy without a VIN field", async () => {
    const getGarage = vi.fn().mockResolvedValue(garage())
    render(
      <GaragePanel
        accessToken="tok"
        adultId="1"
        familyClient={mockFamilyClient({ getGarage })}
        places={[momHouse]}
        defaultLeaveFromPlaceId="p1"
      />,
    )
    expect(screen.getByText("Loading garage…")).toBeInTheDocument()
    expect(
      await screen.findByText("Add a vehicle, or mark that you don’t drive."),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("VIN")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/vin/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add vehicle" })).toBeInTheDocument()
  })

  it("surfaces load errors", async () => {
    const getGarage = vi.fn().mockRejectedValue(new Error("backend not reachable"))
    render(
      <GaragePanel
        accessToken="tok"
        adultId="1"
        familyClient={mockFamilyClient({ getGarage })}
        places={[]}
        defaultLeaveFromPlaceId={null}
      />,
    )
    expect(await screen.findByRole("alert")).toHaveTextContent("backend not reachable")
  })

  it("hides Add vehicle when I don't drive is checked", async () => {
    const user = userEvent.setup()
    const driving = garage()
    const notDriving = garage({
      members: [
        { adultId: "1", displayName: "Mom", drives: false },
        { adultId: "2", displayName: "Dad", drives: true },
      ],
    })
    const getGarage = vi.fn().mockResolvedValue(driving)
    const patchGarageDrives = vi.fn().mockImplementation(async () => {
      getGarage.mockResolvedValue(notDriving)
      return notDriving
    })
    render(
      <GaragePanel
        accessToken="tok"
        adultId="1"
        familyClient={mockFamilyClient({ getGarage, patchGarageDrives })}
        places={[]}
        defaultLeaveFromPlaceId={null}
      />,
    )
    await screen.findByRole("button", { name: "Add vehicle" })
    await user.click(screen.getByLabelText("I don't drive"))
    await waitFor(() => {
      expect(patchGarageDrives).toHaveBeenCalledWith("tok", false)
    })
    expect(screen.queryByRole("button", { name: "Add vehicle" })).not.toBeInTheDocument()
    expect(screen.getByText(/still request rides later/i)).toBeInTheDocument()
  })

  it("shows non-owner cars as read-only", async () => {
    const getGarage = vi.fn().mockResolvedValue(
      garage({
        vehicles: [vehicle({ ownerAdultId: "2", driverAdultIds: ["2", "1"] })],
      }),
    )
    render(
      <GaragePanel
        accessToken="tok"
        adultId="1"
        familyClient={mockFamilyClient({ getGarage })}
        places={[momHouse]}
        defaultLeaveFromPlaceId="p1"
      />,
    )
    expect(await screen.findByText("Blue van")).toBeInTheDocument()
    expect(screen.getByText("Driven by Dad, Mom")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove vehicle" })).not.toBeInTheDocument()
  })

  it("adds a vehicle year then make then model, fills seats, and defaults drivers to me", async () => {
    const user = userEvent.setup()
    const created = vehicle({ driverAdultIds: ["1"] })
    const getGarage = vi
      .fn()
      .mockResolvedValueOnce(garage())
      .mockResolvedValue(garage({ vehicles: [created] }))
    const listGarageMakes = vi.fn().mockResolvedValue([{ name: "HONDA" }])
    const listGarageModels = vi.fn().mockResolvedValue([{ name: "Odyssey" }])
    const suggestGarageSeats = vi.fn().mockResolvedValue({ seats: 8 })
    const addVehicle = vi.fn().mockResolvedValue(created)
    render(
      <GaragePanel
        accessToken="tok"
        adultId="1"
        familyClient={mockFamilyClient({
          getGarage,
          listGarageMakes,
          listGarageModels,
          suggestGarageSeats,
          addVehicle,
        })}
        places={[momHouse]}
        defaultLeaveFromPlaceId="p1"
      />,
    )
    await user.click(await screen.findByRole("button", { name: "Add vehicle" }))
    const form = await screen.findByRole("form", { name: "Add vehicle" })
    expect(within(form).queryByLabelText("VIN")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Can drive: Mom")).toBeChecked()
    expect(screen.getByLabelText("Can drive: Mom")).toBeDisabled()
    expect(screen.getByLabelText("Can drive: Dad")).not.toBeChecked()
    expect(screen.getByLabelText("Kept at")).toHaveValue("p1")

    await user.selectOptions(screen.getByLabelText("Year"), "2019")
    await waitFor(() => expect(listGarageMakes).toHaveBeenCalledWith("tok"))
    await user.selectOptions(screen.getByLabelText("Make"), "HONDA")
    await waitFor(() =>
      expect(listGarageModels).toHaveBeenCalledWith("tok", 2019, "HONDA"),
    )
    await user.selectOptions(screen.getByLabelText("Model"), "Odyssey")
    await waitFor(() =>
      expect(suggestGarageSeats).toHaveBeenCalledWith("tok", {
        year: 2019,
        make: "HONDA",
        model: "Odyssey",
      }),
    )
    await waitFor(() => expect(screen.getByLabelText("Seats")).toHaveValue(8))
    await user.clear(screen.getByLabelText("Seats"))
    await user.type(screen.getByLabelText("Seats"), "7")
    await user.type(screen.getByLabelText("Nickname"), "Blue van")
    await user.click(screen.getByLabelText("Can drive: Dad"))
    await user.click(screen.getByRole("button", { name: "Save vehicle" }))
    await waitFor(() => {
      expect(addVehicle).toHaveBeenCalledWith("tok", {
        label: "Blue van",
        year: 2019,
        make: "HONDA",
        model: "Odyssey",
        seats: 7,
        driverAdultIds: ["1", "2"],
        keptAtPlaceId: "p1",
      })
    })
    expect(JSON.stringify(addVehicle.mock.calls[0]?.[1])).not.toMatch(/vin/i)
  })
})
