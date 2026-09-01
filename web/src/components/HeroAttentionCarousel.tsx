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
import {
  HERO_ALL_CAUGHT_UP,
  HERO_CAROUSEL_ARIA_LABEL,
  HERO_CAROUSEL_NEXT,
  HERO_CAROUSEL_PREVIOUS,
  HERO_EMPTY_BODY,
  HERO_NOTHING_NEEDS_YOU,
  HERO_SECTION_LABEL,
  heroCarouselDotLabel,
  heroQueueCountAnnouncement,
} from "@/components/coverageCopy"
import { pendingCoverageForAdult } from "@/components/coverageDisplay"
import { feedSectionLabelClass } from "@/components/FeedCard"
import { HeroAttentionSlide, type HeroAttentionSlideProps } from "@/components/HeroAttentionSlide"
import {
  heroAttentionSlideAriaLabel,
  heroKidFirstName,
} from "@/components/heroAttentionCopy"

export type HeroAttentionCarouselProps = {
  queue: QueueItem[]
  slidePropsForItem: (item: QueueItem, index: number) => HeroAttentionSlideProps
  showSectionLabel?: boolean
}

function slideKey(item: QueueItem): string {
  return item.kind === "request" ? `req-${item.request.id}` : `own-${item.game.id}`
}

function queueSignature(queue: readonly QueueItem[]): string {
  return queue.map(slideKey).join("|")
}

const HERO_CAROUSEL_FOCUS_RING =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fc-list-row-focus-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"

function slideAriaLabel(
  item: QueueItem,
  slideProps: HeroAttentionSlideProps,
): string {
  return heroAttentionSlideAriaLabel(item, {
    kidFirstName: heroKidFirstName(item.game.kidId, slideProps.circle.kids),
    pendingConfirm: Boolean(
      pendingCoverageForAdult(slideProps.calendarItem, slideProps.currentAdultId),
    ),
  })
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
          {HERO_ALL_CAUGHT_UP}
        </span>
      </div>
      <h2 className="fc-display mb-[var(--fc-space-sm)] text-[length:var(--fc-font-focus-title-size)] leading-[var(--fc-font-focus-title-line)] font-[number:var(--fc-font-focus-title-weight)]">
        {HERO_NOTHING_NEEDS_YOU}
      </h2>
      <p
        className="max-w-xl text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)]"
        style={{ color: "var(--fc-hero-on-secondary)" }}
      >
        {HERO_EMPTY_BODY}
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
  const [liveMessage, setLiveMessage] = useState("")
  const regionId = useId()
  const cardCount = queue.length
  const prevQueueRef = useRef<{ count: number; signature: string; firstKey: string | null }>({
    count: cardCount,
    signature: queueSignature(queue),
    firstKey: queue[0] != null ? slideKey(queue[0]) : null,
  })

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
    const signature = queueSignature(queue)
    const firstKey = queue[0] != null ? slideKey(queue[0]) : null
    const prev = prevQueueRef.current

    if (cardCount === 0 && prev.count > 0) {
      setLiveMessage(`${HERO_ALL_CAUGHT_UP}. ${HERO_NOTHING_NEEDS_YOU}`)
    } else if (cardCount > 0 && signature !== prev.signature) {
      const firstLabel = slideAriaLabel(queue[0]!, slidePropsForItem(queue[0]!, 0))
      if (prev.count === 0 || firstKey !== prev.firstKey) {
        setLiveMessage(firstLabel)
      } else if (cardCount > prev.count) {
        setLiveMessage(heroQueueCountAnnouncement(cardCount))
      }
    }

    prevQueueRef.current = { count: cardCount, signature, firstKey }
  }, [cardCount, queue, slidePropsForItem])

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
      <div
        aria-live="polite"
        aria-atomic="true"
        data-testid="hero-attention-live-region"
        className="sr-only"
      >
        {liveMessage}
      </div>
      {showSectionLabel ? (
        <h2 id={regionId} className={sectionLabelClass}>
          {HERO_SECTION_LABEL}
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
            className={`flex snap-x snap-mandatory overflow-x-auto pb-[var(--fc-space-sm)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${HERO_CAROUSEL_FOCUS_RING}`}
            aria-roledescription="carousel"
            aria-label={HERO_CAROUSEL_ARIA_LABEL}
          >
            {queue.map((item, index) => {
              const slideProps = slidePropsForItem(item, index)
              return (
                <div
                  key={slideKey(item)}
                  data-testid="hero-attention-slide-shell"
                  data-slide-index={index}
                  aria-label={slideAriaLabel(item, slideProps)}
                  className="min-w-full max-w-full shrink-0 snap-start snap-always"
                >
                  <HeroAttentionSlide {...slideProps} />
                </div>
              )
            })}
          </div>

          {cardCount > 1 ? (
            <div
              data-testid="hero-attention-controls"
              className="mt-[var(--fc-space-md)] flex min-w-0 max-w-full flex-wrap items-center justify-center gap-[var(--fc-space-md)]"
            >
              <button
                type="button"
                aria-label={HERO_CAROUSEL_PREVIOUS}
                disabled={activeIndex === 0}
                className={`rounded-full p-1.5 disabled:opacity-30 ${HERO_CAROUSEL_FOCUS_RING}`}
                style={{ background: "var(--fc-hero-carousel-control-bg)" }}
                onClick={() => scrollToIndex(activeIndex - 1)}
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <div
                className="inline-flex min-w-0 flex-wrap items-center justify-center gap-1.5"
                role="tablist"
                aria-label="Carousel slides"
              >
                {queue.map((item, index) => (
                  <button
                    key={slideKey(item)}
                    type="button"
                    role="tab"
                    aria-label={heroCarouselDotLabel(index, cardCount)}
                    aria-selected={index === activeIndex}
                    aria-current={index === activeIndex ? "true" : undefined}
                    data-testid="hero-attention-dot"
                    data-active={index === activeIndex ? "true" : "false"}
                    className={`block shrink-0 rounded-full border-0 p-0 transition-[width,background-color] ${HERO_CAROUSEL_FOCUS_RING}`}
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
                aria-label={HERO_CAROUSEL_NEXT}
                disabled={activeIndex === cardCount - 1}
                className={`rounded-full p-1.5 disabled:opacity-30 ${HERO_CAROUSEL_FOCUS_RING}`}
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
