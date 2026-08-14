import { useCallback, useEffect, useState } from "react"

import type { FamilyClient } from "@/api/familyClient"
import type {
  Garage,
  GarageMemberDrives,
  Place,
  Vehicle,
  VehicleMake,
  VehicleModel,
} from "@/api/types"
import {
  drivenByLabel,
  groupVehiclesByKeptAt,
  MAX_SEATS,
  MIN_SEATS,
  vehicleYearOptions,
} from "@/components/garageDisplay"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string }

type GaragePanelProps = {
  accessToken: string
  adultId: string
  familyClient: FamilyClient
  places: Place[]
  defaultLeaveFromPlaceId: string | null
}

type FormState = {
  vehicleId: string | null
  label: string
  year: string
  make: string
  model: string
  seats: string
  driverAdultIds: string[]
  keptAtPlaceId: string
  seatsTouched: boolean
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"

function emptyForm(adultId: string, defaultLeaveFromPlaceId: string | null): FormState {
  return {
    vehicleId: null,
    label: "",
    year: "",
    make: "",
    model: "",
    seats: "",
    driverAdultIds: [adultId],
    keptAtPlaceId: defaultLeaveFromPlaceId ?? "",
    seatsTouched: false,
  }
}

function formFromVehicle(vehicle: Vehicle): FormState {
  return {
    vehicleId: vehicle.id,
    label: vehicle.label,
    year: String(vehicle.year),
    make: vehicle.make,
    model: vehicle.model,
    seats: String(vehicle.seats),
    driverAdultIds: [...vehicle.driverAdultIds],
    keptAtPlaceId: vehicle.keptAtPlaceId ?? "",
    seatsTouched: true,
  }
}

export function GaragePanel({
  accessToken,
  adultId,
  familyClient,
  places,
  defaultLeaveFromPlaceId,
}: GaragePanelProps) {
  const [garage, setGarage] = useState<Garage | null>(null)
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const [form, setForm] = useState<FormState | null>(null)
  const [makes, setMakes] = useState<VehicleMake[]>([])
  const [models, setModels] = useState<VehicleModel[]>([])
  const years = vehicleYearOptions()

  const reload = useCallback(async () => {
    setStatus({ kind: "loading" })
    try {
      const next = await familyClient.getGarage(accessToken)
      setGarage(next)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }, [accessToken, familyClient])

  useEffect(() => {
    void reload()
  }, [reload])

  async function run(action: () => Promise<void>) {
    setStatus({ kind: "loading" })
    try {
      await action()
      const next = await familyClient.getGarage(accessToken)
      setGarage(next)
      setStatus({ kind: "idle" })
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  const me = garage?.members.find((member) => member.adultId === adultId)
  const drives = me?.drives ?? true
  const busy = status.kind === "loading"
  const groups = garage ? groupVehiclesByKeptAt(garage.vehicles, places) : []

  async function openAdd() {
    const next = emptyForm(adultId, defaultLeaveFromPlaceId)
    setForm(next)
    setModels([])
    try {
      const list = await familyClient.listGarageMakes(accessToken)
      setMakes(list)
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function openEdit(vehicle: Vehicle) {
    const next = formFromVehicle(vehicle)
    setForm(next)
    try {
      const [makeList, modelList] = await Promise.all([
        familyClient.listGarageMakes(accessToken),
        familyClient.listGarageModels(accessToken, vehicle.year, vehicle.make),
      ])
      setMakes(makeList)
      setModels(modelList)
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onYearChange(year: string) {
    if (!form) {
      return
    }
    setForm({ ...form, year, make: "", model: "", seats: form.seatsTouched ? form.seats : "" })
    setModels([])
    if (makes.length === 0) {
      try {
        setMakes(await familyClient.listGarageMakes(accessToken))
      } catch (error) {
        setStatus({
          kind: "error",
          message: error instanceof Error ? error.message : "Something went wrong",
        })
      }
    }
  }

  async function onMakeChange(make: string) {
    if (!form) {
      return
    }
    setForm({ ...form, make, model: "", seats: form.seatsTouched ? form.seats : "" })
    setModels([])
    if (!form.year || !make) {
      return
    }
    try {
      setModels(await familyClient.listGarageModels(accessToken, Number(form.year), make))
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  async function onModelChange(model: string) {
    if (!form) {
      return
    }
    const next = { ...form, model }
    setForm(next)
    if (!form.year || !form.make || !model) {
      return
    }
    try {
      const hint = await familyClient.suggestGarageSeats(accessToken, {
        year: Number(form.year),
        make: form.make,
        model,
      })
      if (hint.seats != null && !form.seatsTouched) {
        setForm({ ...next, seats: String(hint.seats) })
      }
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  function toggleDriver(memberId: string, checked: boolean) {
    if (!form || memberId === adultId) {
      return
    }
    const ids = new Set(form.driverAdultIds)
    if (checked) {
      ids.add(memberId)
    } else {
      ids.delete(memberId)
    }
    ids.add(adultId)
    setForm({ ...form, driverAdultIds: [...ids] })
  }

  const seatsNumber = form ? Number(form.seats) : NaN
  const formValid =
    form != null &&
    form.label.trim().length > 0 &&
    form.year !== "" &&
    form.make !== "" &&
    form.model !== "" &&
    Number.isInteger(seatsNumber) &&
    seatsNumber >= MIN_SEATS &&
    seatsNumber <= MAX_SEATS

  async function onSave() {
    if (!form || !formValid) {
      return
    }
    const body = {
      label: form.label.trim(),
      year: Number(form.year),
      make: form.make,
      model: form.model,
      seats: seatsNumber,
      driverAdultIds: form.driverAdultIds,
      keptAtPlaceId: form.keptAtPlaceId ? form.keptAtPlaceId : null,
    }
    await run(async () => {
      if (form.vehicleId) {
        await familyClient.updateVehicle(accessToken, form.vehicleId, body)
      } else {
        await familyClient.addVehicle(accessToken, body)
      }
      setForm(null)
    })
  }

  return (
    <section aria-label="Garage" className="flex flex-col gap-4">
      {garage == null && status.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading garage…</p>
      ) : null}

      {status.kind === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {status.message}
        </p>
      ) : null}

      {garage != null ? (
        <>
          <section aria-label="My driving" className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label="I don't drive"
                checked={!drives}
                disabled={busy}
                onChange={(event) => {
                  const nextDrives = !event.target.checked
                  if (!nextDrives) {
                    setForm(null)
                  }
                  void run(async () => {
                    await familyClient.patchGarageDrives(accessToken, nextDrives)
                  })
                }}
              />
              I don’t drive
            </label>
            <p className="text-xs text-muted-foreground">
              You can still request rides later. This does not remove cars you own.
            </p>
          </section>

          {drives && form == null ? (
            <Button type="button" onClick={() => void openAdd()} disabled={busy}>
              Add vehicle
            </Button>
          ) : null}

          {form != null ? (
            <form
              aria-label={form.vehicleId ? "Edit vehicle" : "Add vehicle"}
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                void onSave()
              }}
            >
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Year
                <select
                  aria-label="Year"
                  className={selectClass}
                  value={form.year}
                  disabled={busy}
                  onChange={(event) => void onYearChange(event.target.value)}
                >
                  <option value="">Select year</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Make
                <select
                  aria-label="Make"
                  className={selectClass}
                  value={form.make}
                  disabled={busy || !form.year}
                  onChange={(event) => void onMakeChange(event.target.value)}
                >
                  <option value="">Select make</option>
                  {makes.map((make) => (
                    <option key={make.name} value={make.name}>
                      {make.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Model
                <select
                  aria-label="Model"
                  className={selectClass}
                  value={form.model}
                  disabled={busy || !form.make}
                  onChange={(event) => void onModelChange(event.target.value)}
                >
                  <option value="">Select model</option>
                  {models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Seats (including driver)
                <Input
                  aria-label="Seats"
                  type="number"
                  min={MIN_SEATS}
                  max={MAX_SEATS}
                  value={form.seats}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, seats: event.target.value, seatsTouched: true })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Nickname
                <Input
                  aria-label="Nickname"
                  value={form.label}
                  disabled={busy}
                  placeholder="Blue van"
                  onChange={(event) => setForm({ ...form, label: event.target.value })}
                />
              </label>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-xs text-muted-foreground">Who can drive this?</legend>
                {(garage.members.length === 0 ? [{ adultId, displayName: "Me", drives: true }] : garage.members).map(
                  (member: GarageMemberDrives) => {
                    const isOwner = member.adultId === adultId
                    return (
                      <label key={member.adultId} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          aria-label={`Can drive: ${member.displayName}`}
                          checked={form.driverAdultIds.includes(member.adultId)}
                          disabled={busy || isOwner}
                          onChange={(event) =>
                            toggleDriver(member.adultId, event.target.checked)
                          }
                        />
                        {member.displayName}
                        {isOwner ? " (you)" : ""}
                      </label>
                    )
                  },
                )}
              </fieldset>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Kept at
                <select
                  aria-label="Kept at"
                  className={selectClass}
                  value={form.keptAtPlaceId}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, keptAtPlaceId: event.target.value })
                  }
                >
                  <option value="">None</option>
                  {places.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={busy || !formValid}>
                  {form.vehicleId ? "Save vehicle" : "Save vehicle"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setForm(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {garage.vehicles.length === 0 && form == null ? (
            <p className="text-sm text-muted-foreground">
              Add a vehicle, or mark that you don’t drive.
            </p>
          ) : null}

          {groups.map((group) => (
            <section key={group.placeId ?? "other"} aria-label={group.heading} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{group.heading}</p>
              <ul className="flex flex-col gap-2">
                {group.vehicles.map((vehicle) => {
                  const owned = vehicle.ownerAdultId === adultId
                  return (
                    <li key={vehicle.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="flex-1 text-sm">
                        {vehicle.label}
                        <span className="block text-muted-foreground">
                          {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.seats} seats
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {drivenByLabel(vehicle, garage.members)}
                        </span>
                      </span>
                      {owned && form == null ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void openEdit(vehicle)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await familyClient.deleteVehicle(accessToken, vehicle.id)
                              })
                            }
                          >
                            Remove vehicle
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      ) : null}
    </section>
  )
}
