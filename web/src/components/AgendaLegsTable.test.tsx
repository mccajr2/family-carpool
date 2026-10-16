import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CombinedKidRow } from "@/components/combinedEventLayout"
import { AgendaLegsTable } from "@/components/AgendaLegsTable"

function kidRow(
  partial: Pick<CombinedKidRow, "key" | "kidId" | "firstName"> &
    Partial<CombinedKidRow>,
): CombinedKidRow {
  return {
    itemKey: partial.itemKey ?? `FEED-${partial.kidId}`,
    initial: partial.initial ?? partial.firstName.slice(0, 1).toUpperCase(),
    eventLabel: partial.eventLabel ?? "Practice",
    timeLabel: partial.timeLabel ?? "5:00 – 6:00 PM",
    there: partial.there ?? { who: "You", detail: "You · 4:30 PM" },
    back: partial.back ?? { who: "Needs ride", detail: "Needs ride" },
    assignmentLine:
      partial.assignmentLine ?? "There You · Back Needs ride",
    ...partial,
  }
}

describe("AgendaLegsTable", () => {
  it("renders read-only kid rows with Getting there / Coming back details", () => {
    render(
      <AgendaLegsTable
        rows={[
          kidRow({ key: "a-k1", kidId: "k1", firstName: "Sam" }),
          kidRow({
            key: "b-k2",
            kidId: "k2",
            firstName: "Mia",
            there: { who: "Katy", detail: "Katy · 5:00 PM" },
            back: { who: "You", detail: "You · 6:10 PM" },
          }),
        ]}
      />,
    )

    const table = screen.getByTestId("agenda-legs-table")
    expect(within(table).queryByRole("textbox")).not.toBeInTheDocument()
    expect(within(table).queryByRole("combobox")).not.toBeInTheDocument()
    expect(within(table).getByTestId("agenda-legs-row-a-k1")).toHaveTextContent(
      "Sam",
    )
    expect(within(table).getByTestId("agenda-legs-pair-a-k1")).toHaveTextContent(
      /Getting there/,
    )
    expect(within(table).getByTestId("agenda-legs-pair-a-k1")).toHaveTextContent(
      /You · 4:30 PM/,
    )
    expect(within(table).getByTestId("agenda-legs-pair-b-k2")).toHaveTextContent(
      /Coming back/,
    )
    expect(within(table).getByTestId("agenda-legs-pair-b-k2")).toHaveTextContent(
      /You · 6:10 PM/,
    )
  })

  it("keeps TO and FROM View route on their representative rows and passes clicks", async () => {
    const user = userEvent.setup()
    const onTo = vi.fn()
    const onFrom = vi.fn()
    render(
      <AgendaLegsTable
        rows={[
          kidRow({ key: "earliest", kidId: "k1", firstName: "Sam" }),
          kidRow({ key: "latest", kidId: "k1", firstName: "Sam", itemKey: "FEED-b" }),
        ]}
        toViewRoute={{
          rowKey: "earliest",
          onClick: onTo,
          testId: "agenda-block-run-to-view-route",
        }}
        fromViewRoute={{
          rowKey: "latest",
          onClick: onFrom,
          testId: "agenda-block-run-from-view-route",
        }}
      />,
    )

    const table = screen.getByTestId("agenda-legs-table")
    expect(
      within(table).getByTestId("agenda-block-run-to-view-route"),
    ).toBeInTheDocument()
    expect(
      within(table).getByTestId("agenda-block-run-from-view-route"),
    ).toBeInTheDocument()
    // Only one View route per routable leg, hosted on the matching row.
    expect(within(table).getAllByRole("button", { name: "View route" })).toHaveLength(
      2,
    )

    await user.click(within(table).getByTestId("agenda-block-run-to-view-route"))
    expect(onTo).toHaveBeenCalledTimes(1)
    await user.click(within(table).getByTestId("agenda-block-run-from-view-route"))
    expect(onFrom).toHaveBeenCalledTimes(1)
  })

  it("renders nothing when there are no kid rows", () => {
    const { container } = render(<AgendaLegsTable rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
