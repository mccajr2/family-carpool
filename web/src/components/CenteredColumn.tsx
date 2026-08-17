import type { ReactNode } from "react"

/** Signed-out and empty-state column — the pre-page-frame App wrapper. */
export function CenteredColumn({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center px-4 py-10">
      {children}
    </div>
  )
}
