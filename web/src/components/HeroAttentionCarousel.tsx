import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import {
  useCallback,
  useEffect,
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

function activeIndexFromScroll(scroller: HTMLElement, cardCount: number): number {
  if (cardCount <= 1 || scroller.clientWidth === 0) {
    return 0
  }
  return Math.max(
    0,
    Math.min(
      cardCount - 1,
      Math.floor((scroller.scrollLeft + scroller.clientWidth / 2) / scroller.clientWidth),
    ),
  )
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

  const syncActiveIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) {
      return
    }
    setActiveIndex(activeIndexFromScroll(el, cardCount))
  }, [cardCount])

  const scrollToIndex = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, cardCount - 1))
      setActiveIndex(clamped)
      const el = scrollerRef.current
      if (!el || el.clientWidth === 0) {
        return
      }
      el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" })
    },
    [cardCount],
  )

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, cardCount - 1)))
  }, [cardCount])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || cardCount <= 1) {
      return
    }

    const onScroll = () => syncActiveIndexFromScroll()
    el.addEventListener("scroll", onScroll, { passive: true })
    el.addEventListener("scrollend", onScroll)
    return () => {
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("scrollend", onScroll)
    }
  }, [cardCount, queue, syncActiveIndexFromScroll])

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
            onKeyDown={cardCount > 1 ? handleKeyDown : undefined}
            className="flex snap-x snap-mandatory overflow-x-auto pb-[var(--fc-space-sm)] [scrollbar-width:none] focus:outline-none [&::-webkit-scrollbar]:hidden"
            aria-roledescription="carousel"
            aria-label="Needs your attention"
          >
            {queue.map((item, index) => {
              const slideProps = slidePropsForItem(item, index)
              return (
                <div
                  key={slideKey(item)}
                  data-testid="hero-attention-slide-shell"
                  data-slide-index={index}
                  className="min-w-full shrink-0 snap-start snap-always"
                >
                  <HeroAttentionSlide {...slideProps} />
                </div>
              )
            })}
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
              <div
                className="inline-flex shrink-0 items-center gap-1.5"
                role="tablist"
                aria-label="Carousel slides"
              >
                {queue.map((item, index) => (
                  <button
                    key={slideKey(item)}
                    type="button"
                    role="tab"
                    aria-label={`Go to item ${index + 1} of ${cardCount}`}
                    aria-selected={index === activeIndex}
                    aria-current={index === activeIndex ? "true" : undefined}
                    data-testid="hero-attention-dot"
                    data-active={index === activeIndex ? "true" : "false"}
                    className="block shrink-0 rounded-full border-0 p-0 transition-[width,background-color]"
                    style={{
                      width:
                        index === activeIndex
                          ? "var(--fc-space-hero-carousel-dot-active-w)"
                          : "var(--fc-space-hero-carousel-dot-h)",
                      height: "var(--fc-space-hero-carousel-dot-h)",
                      minWidth:
                        index === activeIndex
                          ? "var(--fc-space-hero-carousel-dot-active-w)"
                          : "var(--fc-space-hero-carousel-dot-h)",
                      maxWidth:
                        index === activeIndex
                          ? "var(--fc-space-hero-carousel-dot-active-w)"
                          : "var(--fc-space-hero-carousel-dot-h)",
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
