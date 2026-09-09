import { formatHeroCountdownRing } from "@/components/agendaFocusRing"

/** Adaptive countdown ring for hero carousel slides (days → hours → minutes). */
export function HeroAttentionDaysRing({
  startsAt,
  now = new Date(),
  "data-testid": testId = "hero-attention-days-ring",
}: {
  startsAt: string
  now?: Date
  "data-testid"?: string
}) {
  const { label, unit } = formatHeroCountdownRing(startsAt, now)

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
