import { describe, expect, it } from "vitest"

import { formatRingCountdown } from "@/components/agendaFocusRing"

describe("formatRingCountdown", () => {
  it("shows minutes under an hour", () => {
    expect(formatRingCountdown(0)).toEqual({ label: "0", unit: "min" })
    expect(formatRingCountdown(42)).toEqual({ label: "42", unit: "min" })
    expect(formatRingCountdown(59)).toEqual({ label: "59", unit: "min" })
  })

  it("shows hours under a day", () => {
    expect(formatRingCountdown(60)).toEqual({ label: "1", unit: "hr" })
    expect(formatRingCountdown(150)).toEqual({ label: "2h 30", unit: "hr" })
    expect(formatRingCountdown(1439)).toEqual({ label: "23h 59", unit: "hr" })
  })

  it("shows nearest whole day at 24h and beyond", () => {
    expect(formatRingCountdown(1440)).toEqual({ label: "1", unit: "day" })
    expect(formatRingCountdown(236 * 60 + 39)).toEqual({ label: "10", unit: "days" })
  })

  it("shows an em dash only when minutes are unknown", () => {
    expect(formatRingCountdown(null)).toEqual({ label: "—", unit: "" })
  })
})
