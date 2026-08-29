import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"

import type { QueueItem } from "@/components/coverageQueue"
import { feedSectionLabelClass } from "@/components/FeedCard"
import { HeroAttentionSlide, type HeroAttentionSlideProps } from "@/components/HeroAttentionSlide"

export type HeroAttentionCarouselProps = {
  queue: QueueItem[]
  slidePropsForItem: (item: QueueItem, index: number) => HeroAttentionSlideProps
  showSectionLabel?: boolean
}

function slideKey(item: QueueItem): string {
  return item.kind === "request" ? `req-${item.request.id}` : `own-${item.game.id}`
}

function HeroAttentionEmpty() {
  return (
    <div
      data-testid="hero-attention-empty"
      className="relative overflow-hidden rounded-2xl p-[var(--fc-space-hero-empty-pad)] text-[var(--fc-hero-on)]"
      style={{ background: "var(--fc-hero-glow)" }}
    >
      <div className="mb-[var(--fc-space-sm)] flex items-center gap-[var(--fc-space-md)]">
        <CheckCircle2
          size={28}
          aria-hidden
          style={{ color: "var(--fc-hero-success)" }}
        />
        <span
          className="text-sm uppercase tracking-widest"
          style={{ color: "var(--fc-hero-on-secondary)" }}
        >
          All caught up
        </span>
      </div>
      <h2 className="fc-display mb-[var(--fc-space-sm)] text-[length:var(--fc-font-focus-title-size)] leading-[var(--fc-font-focus-title-line)] font-[number:var(--fc-font-focus-title-weight)]">
        Nothing needs you right now
      </h2>
      <p
        className="max-w-xl text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)]"
        style={{ color: "var(--fc-hero-on-secondary)" }}
      >
        Every ride this week is either covered or waiting on someone else. We&apos;ll bring the
        next thing here the moment it needs a decision from you.
      </p>
    </div>
  )
}

export function HeroAttentionCarousel({
  queue,
  slidePropsForItem,
  showSectionLabel = true,
}: HeroAttentionCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const regionId = useId()
  const cardCount = queue.length

  const scrollToIndex = useCallback(
    (idx: number) => {
      const el = scrollerRef.current
      if (!el) {
        return
      }
      const clamped = Math.max(0, Math.min(idx, cardCount - 1))
      const track = el.children[0]
      const card = track?.children[clamped] as HTMLElement | undefined
      card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      setActiveIndex(clamped)
    },
    [cardCount],
  )

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current
    const track = el?.children[0] as HTMLElement | undefined
    if (!el || !track) {
      return
    }
    let closest = 0
    let bestDist = Infinity
    Array.from(track.children).forEach((child, index) => {
      const dist = Math.abs((child as HTMLElement).offsetLeft - el.scrollLeft)
      if (dist < bestDist) {
        bestDist = dist
        closest = index
      }
    })
    setActiveIndex(closest)
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      scrollToIndex(activeIndex - 1)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      scrollToIndex(activeIndex + 1)
    }
  }

  const sectionLabelClass = `${feedSectionLabelClass} !mb-[var(--fc-space-md)] font-semibold tracking-widest`

  return (
    <section data-testid="hero-attention-carousel" aria-labelledby={showSectionLabel ? regionId : undefined}>
      {showSectionLabel ? (
        <h2 id={regionId} className={sectionLabelClass}>
          Needs your attention
        </h2>
      ) : null}

      {cardCount === 0 ? (
        <HeroAttentionEmpty />
      ) : (
        <>
          <div
            ref={scrollerRef}
            data-testid="hero-attention-scroller"
            tabIndex={cardCount > 1 ? 0 : undefined}
            onScroll={handleScroll}
            onKeyDown={cardCount > 1 ? handleKeyDown : undefined}
            className="overflow-x-auto pb-[var(--fc-space-sm)] [scrollbar-width:none] focus:outline-none [&::-webkit-scrollbar]:hidden"
            style={{ scrollSnapType: "x mandatory" }}
            aria-roledescription="carousel"
            aria-label="Needs your attention"
          >
            <div
              className="flex"
              style={{
                width: "max-content",
                gap: "var(--fc-space-hero-carousel-gap)",
              }}
            >
              {queue.map((item, index) => {
                const slideProps = slidePropsForItem(item, index)
                return (
                <div
                  key={slideKey(item)}
                  data-testid="hero-attention-slide-shell"
                  data-slide-index={index}
                  className="shrink-0"
                  style={{
                    scrollSnapAlign: "center",
                    width:
                      "min(var(--fc-space-hero-carousel-slide-max), 84vw)",
                  }}
                >
                  <HeroAttentionSlide {...slideProps} />
                </div>
                )
              })}
            </div>
          </div>

          {cardCount > 1 ? (
            <div
              data-testid="hero-attention-controls"
              className="mt-[var(--fc-space-md)] flex items-center justify-center gap-[var(--fc-space-md)]"
            >
              <button
                type="button"
                aria-label="Previous item"
                disabled={activeIndex === 0}
                className="rounded-full p-1.5 disabled:opacity-30"
                style={{ background: "var(--fc-hero-carousel-control-bg)" }}
                onClick={() => scrollToIndex(activeIndex - 1)}
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <div className="flex items-center gap-1.5">
                {queue.map((item, index) => (
                  <button
                    key={slideKey(item)}
                    type="button"
                    aria-label={`Go to item ${index + 1} of ${cardCount}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    data-testid="hero-attention-dot"
                    data-active={index === activeIndex ? "true" : "false"}
                    className="rounded-full transition-all"
                    style={{
                      width:
                        index === activeIndex
                          ? "var(--fc-space-hero-carousel-dot-active-w)"
                          : "var(--fc-space-hero-carousel-dot-h)",
                      height: "var(--fc-space-hero-carousel-dot-h)",
                      background:
                        index === activeIndex
                          ? "var(--fc-text-primary)"
                          : "var(--fc-hero-carousel-dot-inactive)",
                    }}
                    onClick={() => scrollToIndex(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next item"
                disabled={activeIndex === cardCount - 1}
                className="rounded-full p-1.5 disabled:opacity-30"
                style={{ background: "var(--fc-hero-carousel-control-bg)" }}
                onClick={() => scrollToIndex(activeIndex + 1)}
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
