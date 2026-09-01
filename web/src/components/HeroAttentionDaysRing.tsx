import { formatHeroDaysRing } from "@/components/agendaFocusRing"

/** Decorative days-until ring for hero carousel slides (mock CountdownRing). */
export function HeroAttentionDaysRing({
  days,
  "data-testid": testId = "hero-attention-days-ring",
}: {
  days: number
  "data-testid"?: string
}) {
  const { label, unit } = formatHeroDaysRing(days)

  return (
    <div
      data-testid={testId}
      aria-hidden
      className="flex shrink-0 flex-col items-center justify-center rounded-full text-[var(--fc-hero-on)]"
      style={{
        width: 84,
        height: 84,
        border: "3px solid var(--fc-hero-ring)",
      }}
    >
      <div className="text-xl font-bold leading-none">{label}</div>
      <div
        className="mt-1 text-[10px] font-semibold tracking-widest"
        style={{ color: "var(--fc-hero-on-secondary)" }}
      >
        {unit}
      </div>
    </div>
  )
}
