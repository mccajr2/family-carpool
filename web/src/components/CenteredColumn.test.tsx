import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CenteredColumn } from "@/components/CenteredColumn"

describe("CenteredColumn", () => {
  it("keeps the pre-page-frame max-w-5xl centered column", () => {
    render(
      <CenteredColumn>
        <p>Inside</p>
      </CenteredColumn>,
    )
    const inner = screen.getByText("Inside")
    expect(inner.closest("[class*='max-w-5xl']")).not.toBeNull()
    expect(inner.closest("[class*='mx-auto']")).not.toBeNull()
  })
})
