import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  Calendar, Car, Users, MapPin, Warehouse, Rss, LogOut, Clock3,
  Circle, CheckCircle2, Clock, ChevronRight, ChevronLeft, ChevronDown,
  ChevronUp, Check, X, Bell, Undo2, Navigation, Home, Flag, MessageCircle,
  Info, Loader2, Music, Play, Shuffle, ArrowLeft,
} from "lucide-react";

// ---- palette ------------------------------------------------------------
const C = {
  page: "#F3F1EA",
  sidebar: "#14161F",
  sidebarActive: "#22242F",
  heroGlow: "radial-gradient(120% 140% at 85% 0%, #2A2E63 0%, #11131C 55%)",
  ring: "#E3A15B",
  amber: "#B5793A",
  amberBg: "#F4E6D2",
  green: "#2F7A4D",
  greenBg: "#DFF0E4",
  teal: "#1F6E6E",
  tealBg: "#DCEEED",
  blue: "#3454D1",
  blueBg: "#E1E6FB",
  far: "#A6483F",
  gray: "#6B7080",
  grayBg: "#ECEBE6",
  border: "#E7E4DC",
  ink: "#15161C",
  sub: "#6B6F7B",
};

const HOUSEHOLD = ["You", "Jordan", "Grandma Pat"];

// ---- seed data ------------------------------------------------------------
// request.status: "pending" | "accepted" | "declined" | "withdrawn"
// request.autoDeclined: true when the system declined it, not the parent
// request.pickupTown / detourMinutes: shown so the parent can judge the ask
//
// carpoolRoute lives on a game once its ride is actually confirmed (a
// driver, or a teammate driving) — that's the only time a route or a
// playlist for the drive actually means anything. stops/legMinutes drive
// the route tab; playlistRiders drives the playlist tab. Fictional track
// names — not real songs/artists.
const initialGames = [
  {
    id: 1, order: 0,
    team: "Sharks · 2016/2017 (BILL)", opponent: "Rhode Island Junior Blues",
    date: "Fri, Aug 28", time: "4:00 – 5:00 PM", rink: "Allied Veterans Rink, Everett",
    kid: "Declan", attendance: "going", ownRide: "unassigned", requests: [],
  },
  {
    id: 2, order: 1,
    team: "Sharks · 2016/2017 (BILL)", opponent: "Mass Admirals",
    date: "Sat, Aug 29", time: "5:20 – 6:20 PM", rink: "Allied Veterans Rink, Everett",
    kid: "Declan", attendance: "going", ownRide: "unassigned",
    requests: [{ id: "r1", parent: "the Nguyens", kid: "Ben", status: "pending", pickupTown: "Cambridge, MA", detourMinutes: 4 }],
  },
  {
    id: 3, order: 2,
    team: "Sharks · 2016/2017 (BILL)", opponent: "East Coast Thunder",
    date: "Sun, Aug 30", time: "12:40 – 1:40 PM", rink: "Allied Veterans Rink, Everett",
    kid: "Declan", attendance: "going", ownRide: { driver: "You", confirmed: true },
    requests: [{ id: "r2", parent: "the Oseis", kid: "Kwame", status: "accepted", pickupTown: "Somerville, MA", detourMinutes: 7 }],
    carpoolRoute: {
      bufferMinutes: 45,
      stops: [
        { name: "Home", address: "390 Huron Ave, Cambridge, MA", kind: "home" },
        { name: "Kwame (the Oseis)", address: "Somerville, MA", kind: "pickup", contact: { channel: "push", to: "the Oseis" } },
        { name: "Allied Veterans Rink", address: "65 Elm St, Everett, MA", kind: "destination" },
      ],
      legMinutes: [12, 18],
      playlistRiders: [
        {
          name: "Declan", connected: true, playlistName: "Declan's Warmup Mix",
          tracks: [
            { title: "Sunset Drive", artist: "Coastline", sec: 198 },
            { title: "Neon Static", artist: "Halfway House", sec: 221 },
            { title: "Overtime", artist: "Pace Car", sec: 176 },
            { title: "Rink Lights", artist: "Coastline", sec: 204 },
          ],
        },
        { name: "Kwame", connected: false, contact: { channel: "push", to: "the Oseis" } },
      ],
    },
  },
  {
    id: 4, order: 3,
    team: "Comets · 12U", opponent: "Boston Blaze",
    date: "Sun, Aug 30", time: "6:00 – 7:00 PM", rink: "Chelsea Community Rink",
    kid: "Maya", attendance: "going", ownRide: "unassigned",
    requests: [{ id: "r4", parent: "the Kowalskis", kid: "Zoe", status: "pending", pickupTown: "Worcester, MA", detourMinutes: 38 }],
  },
  {
    id: 5, order: 4,
    team: "Sharks · 2016/2017 (BILL)", opponent: "Practice",
    date: "Tue, Sep 1", time: "6:00 – 7:00 PM", rink: "Allied Veterans Rink, Everett",
    kid: "Declan", attendance: "going", ownRide: { teammate: "Coach Lin" }, requests: [],
    carpoolRoute: {
      bufferMinutes: 15,
      stops: [
        { name: "Home", address: "390 Huron Ave, Cambridge, MA", kind: "home" },
        { name: "Allied Veterans Rink", address: "65 Elm St, Everett, MA", kind: "destination" },
      ],
      legMinutes: [14],
      playlistRiders: [
        {
          name: "Declan", connected: true, playlistName: "Declan's Warmup Mix",
          tracks: [
            { title: "Sunset Drive", artist: "Coastline", sec: 198 },
            { title: "Neon Static", artist: "Halfway House", sec: 221 },
            { title: "Overtime", artist: "Pace Car", sec: 176 },
          ],
        },
      ],
    },
  },
  {
    id: 6, order: 5,
    team: "Sharks · 2016/2017 (BILL)", opponent: "Vermont Voyagers",
    date: "Wed, Sep 2", time: "5:00 – 6:00 PM", rink: "Allied Veterans Rink, Everett",
    kid: "Declan", attendance: "going", ownRide: "requested",
    requests: [{ id: "r3", parent: "the Patels", kid: "Arjun", status: "withdrawn", pickupTown: "Medford, MA", detourMinutes: 15 }],
  },
];

function daysOut(dateLabel) {
  const map = {
    "Fri, Aug 28": 1, "Sat, Aug 29": 2, "Sun, Aug 30": 3,
    "Tue, Sep 1": 5, "Wed, Sep 2": 6,
  };
  return map[dateLabel] ?? 1;
}

function isUnassigned(g) { return g.ownRide === "unassigned"; }
function isPendingHouseholdConfirm(g) {
  return typeof g.ownRide === "object" && "driver" in g.ownRide && g.ownRide.confirmed === false;
}
function isConfirmedDriver(g) {
  return typeof g.ownRide === "object" && "driver" in g.ownRide && g.ownRide.confirmed === true;
}
function isTeammateDriving(g) { return typeof g.ownRide === "object" && "teammate" in g.ownRide; }
function acceptedRiders(g) { return g.requests.filter((r) => r.status === "accepted"); }
function pendingRequests(g) { return g.requests.filter((r) => r.status === "pending"); }

// A ride only has a route/playlist worth showing once it's actually
// confirmed — either you (or someone in the household) are driving, or a
// teammate's parent is. "Unassigned" or "asked the team" has nothing to
// route yet, so it deliberately doesn't get the entry point.
function canRoute(g) {
  return !!g.carpoolRoute && (isConfirmedDriver(g) || isTeammateDriving(g)) && g.attendance !== "not_going";
}

// A parent who has explicitly asked the wider team for their own ride has
// said, in effect, "I don't have a ride, so I can't offer one." Any pending
// ask on that same game is auto-declined the instant that happens — not
// when the ride is merely unassigned (still might resolve to "I'll drive"),
// only once help has actually been requested.
function autoDeclineUnofferable(games) {
  return games.map((g) => {
    if (g.ownRide !== "requested") return g;
    if (pendingRequests(g).length === 0) return g;
    return {
      ...g,
      requests: g.requests.map((r) => (r.status === "pending" ? { ...r, status: "declined", autoDeclined: true } : r)),
    };
  });
}

// ---- priority queue -------------------------------------------------------
function getQueue(games) {
  const sorted = [...games].sort((a, b) => a.order - b.order);
  const gaps = sorted
    .filter((g) => isUnassigned(g) && g.attendance !== "not_going")
    .map((g) => ({ type: "ownRide", game: g }));
  const reqs = [];
  for (const g of sorted) {
    for (const r of g.requests) {
      if (r.status === "pending") reqs.push({ type: "request", game: g, request: r });
    }
  }
  return [...gaps, ...reqs];
}

// ---- time helpers (shared by route + playlist tabs) -----------------------
function toMinutes(t) {
  const [, h, m, ap] = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  let hours = parseInt(h, 10) % 12;
  if (ap.toUpperCase() === "PM") hours += 12;
  return hours * 60 + parseInt(m, 10);
}
function toTime(mins) {
  const h24 = Math.floor(((mins % 1440) + 1440) % 1440 / 60);
  const m = ((mins % 60) + 60) % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmtMinSec(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
// "5:20 – 6:20 PM" -> "5:20 PM". The start time often has no AM/PM of its
// own in the game's display string, so borrow it from the end time.
function eventStartTime(game) {
  const [rawStart, rawEnd = ""] = game.time.split("–").map((s) => s.trim());
  if (/AM|PM/i.test(rawStart)) return rawStart;
  const ap = (rawEnd.match(/AM|PM/i) || [""])[0];
  return `${rawStart} ${ap}`.trim();
}
// Backward-plan every stop's time from the arrival deadline.
function computeSchedule(carpoolRoute, eventStart) {
  const arriveBy = toMinutes(eventStart) - carpoolRoute.bufferMinutes;
  const times = new Array(carpoolRoute.stops.length);
  times[carpoolRoute.stops.length - 1] = arriveBy;
  for (let i = carpoolRoute.stops.length - 2; i >= 0; i--) {
    times[i] = times[i + 1] - carpoolRoute.legMinutes[i];
  }
  return { arriveBy, stopTimes: times };
}
function encode(addr) { return encodeURIComponent(addr); }
function navigationUrl(stops) {
  const origin = encode(stops[0].address);
  const destination = encode(stops[stops.length - 1].address);
  const waypoints = stops.slice(1, -1).map((s) => encode(s.address)).join("|");
  const wp = waypoints ? `&waypoints=${waypoints}` : "";
  // No API key required — this is the public, free "universal" Maps URL,
  // and opens the native app on mobile or maps.google.com on desktop with
  // real turn-by-turn navigation ready to go.
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${wp}&travelmode=driving`;
}
function embedUrl(stops, apiKey) {
  if (!apiKey) return null;
  const origin = encode(stops[0].address);
  const destination = encode(stops[stops.length - 1].address);
  const waypoints = stops.slice(1, -1).map((s) => encode(s.address)).join("|");
  const wp = waypoints ? `&waypoints=${waypoints}` : "";
  return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}${wp}&mode=driving`;
}
// Fair round-robin merge across connected riders' playlists only.
function mergeTracks(riders) {
  const connected = riders.filter((r) => r.connected);
  const queues = connected.map((r) => [...r.tracks]);
  const merged = [];
  let remaining = queues.reduce((n, q) => n + q.length, 0);
  let i = 0;
  while (remaining > 0) {
    const qi = i % queues.length;
    if (queues[qi].length > 0) {
      merged.push({ ...queues[qi].shift(), from: connected[qi].name });
      remaining--;
    }
    i++;
  }
  return merged;
}

// ---- chip -------------------------------------------------------------------
function Chip({ tone, icon, children }) {
  const tones = {
    amber: { bg: C.amberBg, fg: C.amber },
    green: { bg: C.greenBg, fg: C.green },
    teal: { bg: C.tealBg, fg: C.teal },
    blue: { bg: C.blueBg, fg: C.blue },
    gray: { bg: C.grayBg, fg: C.gray },
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide whitespace-nowrap" style={{ background: tones.bg, color: tones.fg }}>
      {icon}
      {children}
    </span>
  );
}

function ridersCount(game) { return acceptedRiders(game).length; }

function StatusChip({ game }) {
  if (game.attendance === "not_going") return <Chip tone="gray" icon={<X size={12} />}>Not going</Chip>;
  const ownRide = game.ownRide;
  if (ownRide === "unassigned") return <Chip tone="amber" icon={<Circle size={11} />}>Ride needed</Chip>;
  if (ownRide === "requested") return <Chip tone="blue" icon={<Users size={12} />}>Asked the team</Chip>;
  if (typeof ownRide === "object" && "teammate" in ownRide) return <Chip tone="green" icon={<Car size={12} />}>Riding with {ownRide.teammate}</Chip>;
  if (typeof ownRide === "object" && "driver" in ownRide) {
    const { driver, confirmed } = ownRide;
    if (!confirmed) return <Chip tone="amber" icon={<Clock3 size={12} />}>Waiting on {driver}</Chip>;
    const riders = ridersCount(game);
    const label = driver === "You" ? "You're driving" : `${driver} driving`;
    if (riders > 0) return <Chip tone="teal" icon={<Users size={12} />}>{label} · +{riders}</Chip>;
    return <Chip tone="green" icon={<Car size={12} />}>{label}</Chip>;
  }
  return null;
}

function CarpoolAskChip({ count }) {
  if (!count) return null;
  return <Chip tone="amber" icon={<Bell size={12} />}>{count} carpool ask{count > 1 ? "s" : ""}</Chip>;
}

// ---- pickup info: the actual decision-making detail --------------------------
function pickupTone(minutes) {
  if (minutes <= 10) return { color: C.green, label: "On your way" };
  if (minutes <= 20) return { color: C.amber, label: "Bit of a detour" };
  return { color: C.far, label: "Far out of the way" };
}

function PickupLine({ request, dark }) {
  if (!request.pickupTown) return null;
  const tone = pickupTone(request.detourMinutes ?? 0);
  return (
    <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: dark ? "#D6D8E0" : C.sub }}>
      <MapPin size={12} style={{ color: tone.color }} />
      Pickup in {request.pickupTown}
      <span style={{ color: tone.color, fontWeight: 600 }}>
        · ~{request.detourMinutes} min out of your way ({tone.label})
      </span>
    </div>
  );
}

// ---- not-going toggle ---------------------------------------------------------
// The attendance toggle always says "going" — never "make it" — so it can
// never be confused with the ride-side revert links, which always say
// "drive." Different question, different word.
function AttendanceToggle({ game, onSetAttendance, dark }) {
  const mutedColor = dark ? "#B7BAC6" : C.sub;
  if (game.attendance === "not_going") {
    return (
      <p className="text-xs mt-2" style={{ color: mutedColor }}>
        {game.kid} is marked not going.{" "}
        <button onClick={() => onSetAttendance(game.id, "going")} className="underline underline-offset-2 font-semibold">
          Mark as going again
        </button>
      </p>
    );
  }
  return (
    <button onClick={() => onSetAttendance(game.id, "not_going")} className="text-xs underline underline-offset-2" style={{ color: mutedColor }}>
      Mark {game.kid} as not going
    </button>
  );
}

// ---- driver picker ------------------------------------------------------------
function DriverPicker({ game, onAssign, onAskTeam, dark }) {
  const current = isConfirmedDriver(game) || isPendingHouseholdConfirm(game) ? game.ownRide.driver : "You";
  const [selected, setSelected] = useState(current);
  const mutedColor = dark ? "#8B8FA0" : C.sub;
  const dividerColor = dark ? "rgba(255,255,255,0.14)" : C.border;

  if (isPendingHouseholdConfirm(game)) {
    return (
      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: dark ? "rgba(227,161,91,0.15)" : C.amberBg }}>
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: dark ? C.ring : C.amber }}>
          <Clock3 size={16} /> Waiting on {game.ownRide.driver} to confirm
        </div>
        <div className="flex gap-2">
          <button onClick={() => onAssign(game.id, game.ownRide.driver, true)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: dark ? "#fff" : C.green, color: dark ? C.ink : "#fff" }} title="Demo shortcut: simulate their confirmation">
            Simulate confirm
          </button>
          <button onClick={() => onAssign(game.id, "unassigned")} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: dark ? "rgba(255,255,255,0.12)" : "#fff", color: dark ? "#fff" : C.ink, border: dark ? "none" : `1px solid ${C.border}` }}>
            Cancel ask
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Path 1: pick someone in the household and confirm — chips and the
          confirm button are kept tight together so it reads as one choice. */}
      <div className="flex flex-wrap gap-2 mb-3">
        {HOUSEHOLD.map((name) => (
          <button key={name} onClick={() => setSelected(name)} className="rounded-full px-3.5 py-1.5 text-sm font-semibold" style={selected === name ? { background: dark ? "#fff" : C.ink, color: dark ? C.ink : "#fff" } : { background: dark ? "rgba(255,255,255,0.1)" : "#fff", color: dark ? "#fff" : C.ink, border: dark ? "none" : `1px solid ${C.border}` }}>
            {name}
          </button>
        ))}
      </div>
      <button onClick={() => onAssign(game.id, selected, selected === "You")} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: dark ? "#fff" : C.blue, color: dark ? C.ink : "#fff" }}>
        {selected === "You" ? "Confirm I'll drive" : `Ask ${selected} to drive`}
      </button>

      {/* Path 2: a separate, unrelated option — visually detached with a
          divider and its own caption so it doesn't read as tied to the chips
          above. */}
      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${dividerColor}` }}>
        <div className="text-xs mb-2" style={{ color: mutedColor }}>Nobody in the household free?</div>
        <button onClick={() => onAskTeam(game.id)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: dark ? "rgba(255,255,255,0.12)" : C.grayBg, color: dark ? "#fff" : C.ink }}>
          Ask the team for a ride
        </button>
      </div>
    </div>
  );
}

// ---- revert link for an already-resolved ride ---------------------------------
// All ride-side revert links say "drive" — never "make it" — so they can
// never be confused with the attendance toggle, which always says "going."
function RevertRideLink({ game, onCantMakeIt, dark }) {
  const mutedColor = dark ? "#B7BAC6" : C.sub;
  if (isConfirmedDriver(game)) {
    const label = game.ownRide.driver === "You" ? "Can't drive anymore? Reassign the ride" : `${game.ownRide.driver} can't drive anymore? Reassign the ride`;
    return (
      <button onClick={() => onCantMakeIt(game.id)} className="text-xs underline underline-offset-2 mt-2 text-left" style={{ color: mutedColor }}>
        {label}
      </button>
    );
  }
  if (game.ownRide === "requested") {
    return <button onClick={() => onCantMakeIt(game.id)} className="text-xs underline underline-offset-2 mt-2" style={{ color: mutedColor }}>No longer need a ride? Cancel this ask</button>;
  }
  if (typeof game.ownRide === "object" && "teammate" in game.ownRide) {
    return (
      <button onClick={() => onCantMakeIt(game.id)} className="text-xs underline underline-offset-2 mt-2 text-left" style={{ color: mutedColor }}>
        {game.ownRide.teammate} can't drive anymore? Find a new ride
      </button>
    );
  }
  return null;
}

// ---- hero carousel ----------------------------------------------------------
function HeroCarousel({ queue, openCount, handlers }) {
  const scrollerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardCount = queue.length;

  const scrollToIndex = useCallback((idx) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(idx, cardCount - 1));
    const track = el.children[0];
    const card = track?.children[clamped];
    if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveIndex(clamped);
  }, [cardCount]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    const track = el?.children[0];
    if (!track) return;
    let closest = 0, bestDist = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft - el.scrollLeft);
      if (dist < bestDist) { bestDist = dist; closest = i; }
    });
    setActiveIndex(closest);
  };

  if (cardCount === 0) {
    return (
      <div className="rounded-2xl p-8 text-white relative overflow-hidden" style={{ background: C.heroGlow }}>
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 size={28} color="#8FE3B0" />
          <span className="text-sm uppercase tracking-widest text-gray-300">All caught up</span>
        </div>
        <h2 className="text-3xl font-bold mb-2">Nothing needs you right now</h2>
        <p className="text-gray-300 max-w-xl">Every ride this week is either covered or waiting on someone else. We'll bring the next thing here the moment it needs a decision from you.</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={scrollerRef} onScroll={handleScroll} className="overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
        <div className="flex gap-4" style={{ width: "max-content" }}>
          {queue.map((item, i) => {
            const key = item.type === "request" ? `req-${item.request.id}` : `own-${item.game.id}`;
            return (
              <div key={key} style={{ scrollSnapAlign: "center", width: "min(640px, 84vw)" }} className="shrink-0">
                <HeroSlide item={item} isTop={i === 0} openCount={openCount} handlers={handlers} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-3">
        <button onClick={() => scrollToIndex(activeIndex - 1)} disabled={activeIndex === 0} className="rounded-full p-1.5 disabled:opacity-30" style={{ background: C.grayBg }}><ChevronLeft size={16} /></button>
        <div className="flex items-center gap-1.5">
          {queue.map((_, i) => (
            <button key={i} onClick={() => scrollToIndex(i)} className="rounded-full transition-all" style={{ width: i === activeIndex ? 18 : 7, height: 7, background: i === activeIndex ? C.ink : "#C9C6BC" }} aria-label={`Go to item ${i + 1} of ${cardCount}`} />
          ))}
        </div>
        <button onClick={() => scrollToIndex(activeIndex + 1)} disabled={activeIndex === cardCount - 1} className="rounded-full p-1.5 disabled:opacity-30" style={{ background: C.grayBg }}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function HeroSlide({ item, isTop, openCount, handlers }) {
  const { game } = item;
  const n = daysOut(game.date);
  const { onAssign, onAskTeam, onRespond } = handlers;

  return (
    <div className="rounded-2xl p-7 text-white relative overflow-hidden h-full" style={{ background: C.heroGlow }}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-2 flex-wrap">
            {isTop ? (
              <>
                <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(227,161,91,0.18)" }}>Most urgent</span>
                {openCount > 1 && <span className="text-gray-400">· {openCount} things need you</span>}
              </>
            ) : <span className="text-gray-400">Up next</span>}
          </div>

          {item.type === "ownRide" && (
            <>
              <h2 className="text-3xl font-bold leading-tight mb-2">{game.kid} needs a ride</h2>
              <p className="text-gray-300">{game.team} vs {game.opponent} · {game.date}, {game.time}</p>
              <p className="text-gray-400 text-sm mt-1">{game.rink}</p>
              <div className="mt-5 [&_button]:text-sm">
                <DriverPicker game={game} onAssign={onAssign} onAskTeam={onAskTeam} dark />
              </div>
            </>
          )}

          {item.type === "request" && (
            <>
              <h2 className="text-3xl font-bold leading-tight mb-2">{item.request.parent} need a ride for {item.request.kid}</h2>
              <p className="text-gray-300">{game.team} vs {game.opponent} · {game.date}, {game.time}</p>
              <p className="text-gray-400 text-sm mt-1">{game.rink} · {game.kid} is already going</p>
              <PickupLine request={item.request} dark />
              <div className="flex gap-3 mt-6">
                <button onClick={() => onRespond(game.id, item.request.id, "accepted")} className="rounded-xl px-5 py-3 font-semibold" style={{ background: "#fff", color: C.ink }}>Accept</button>
                <button onClick={() => onRespond(game.id, item.request.id, "declined")} className="rounded-xl px-5 py-3 font-semibold" style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>Decline</button>
              </div>
            </>
          )}
        </div>
        <CountdownRing n={n} label={n === 1 ? "DAY" : "DAYS"} />
      </div>
    </div>
  );
}

function CountdownRing({ n, label }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-full shrink-0" style={{ width: 84, height: 84, border: `3px solid ${C.ring}`, color: "#fff" }}>
      <div className="text-xl font-bold leading-none">{n}</div>
      <div className="text-[10px] tracking-widest text-gray-300 mt-1">{label}</div>
    </div>
  );
}

// ---- weekly list card -------------------------------------------------------
function GameCard({ game, isFocused, handlers, onOpenRide }) {
  const [open, setOpen] = useState(false);
  const { onAssign, onAskTeam, onRespond, onWithdraw, onCantMakeIt, onSetAttendance } = handlers;
  const pending = pendingRequests(game);
  const showDriverPicker = game.attendance !== "not_going" && (isUnassigned(game) || isPendingHouseholdConfirm(game));
  const showRevertLink = game.attendance !== "not_going" && !showDriverPicker;
  const canOffer = isConfirmedDriver(game);
  const routable = canRoute(game);

  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ border: `1px solid ${isFocused ? C.ring : C.border}`, boxShadow: isFocused ? `0 0 0 3px ${C.amberBg}` : "none" }}>
      <button className="w-full text-left px-6 py-5 flex items-center justify-between gap-4" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: C.sub }}>{game.team}</div>
          <div className="text-lg font-bold truncate" style={{ color: C.ink }}>vs {game.opponent}</div>
          <div className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: C.sub }}><Clock size={14} /> {game.date} · {game.time}</div>
          <div className="text-sm flex items-center gap-1.5" style={{ color: C.sub }}><MapPin size={14} /> {game.rink}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-[50%]">
          <StatusChip game={game} />
          <CarpoolAskChip count={pending.length} />
          {routable && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onOpenRide(game.id); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onOpenRide(game.id); } }}
              className="rounded-full p-1.5 inline-flex"
              style={{ background: C.blueBg, color: C.blue }}
              title="View route & playlist"
            >
              <Navigation size={14} />
            </span>
          )}
          {open ? <ChevronUp size={18} color={C.sub} /> : <ChevronDown size={18} color={C.sub} />}
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-1 border-t" style={{ borderColor: C.border }}>
          {game.attendance !== "not_going" && (
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: C.blue }}>{game.kid[0]}</span>
                {game.kid}
              </div>
              <StatusChip game={game} />
            </div>
          )}

          {showDriverPicker && <div className="mb-2"><DriverPicker game={game} onAssign={onAssign} onAskTeam={onAskTeam} /></div>}
          {showRevertLink && <RevertRideLink game={game} onCantMakeIt={onCantMakeIt} />}

          <div className="mt-3"><AttendanceToggle game={game} onSetAttendance={onSetAttendance} /></div>

          {routable && (
            <button
              onClick={() => onOpenRide(game.id)}
              className="mt-4 w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ background: C.blueBg, color: C.blue }}
            >
              <span className="flex items-center gap-2"><Navigation size={15} /> Route & playlist for this ride</span>
              <ChevronRight size={16} />
            </button>
          )}

          {game.requests.length > 0 && (
            <div className="mt-4 space-y-2">
              {game.requests.map((r) => (
                <RequestRow key={r.id} gameId={game.id} r={r} canOffer={canOffer} onRespond={onRespond} onWithdraw={onWithdraw} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestRow({ gameId, r, canOffer, onRespond, onWithdraw }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: C.page }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
          <Car size={15} color={C.sub} />
          {r.parent} need a ride for {r.kid}
        </div>

        {r.status === "pending" && (
          <div className="flex gap-2">
            <button onClick={() => onRespond(gameId, r.id, "accepted")} className="rounded-lg px-3 py-1 text-xs font-semibold text-white" style={{ background: C.green }}>Accept</button>
            <button onClick={() => onRespond(gameId, r.id, "declined")} className="rounded-lg px-3 py-1 text-xs font-semibold" style={{ background: C.grayBg, color: C.ink }}>Decline</button>
          </div>
        )}

        {r.status === "accepted" && (
          <div className="flex items-center gap-2">
            <Chip tone="green" icon={<Check size={12} />}>Accepted</Chip>
            <button onClick={() => onWithdraw(gameId, r.id)} className="text-xs underline underline-offset-2" style={{ color: C.sub }}>Can't take them anymore</button>
          </div>
        )}

        {r.status === "declined" && (
          <div className="flex items-center gap-2">
            <Chip tone="gray" icon={<X size={12} />}>{r.autoDeclined ? "Declined — you needed a ride too" : "Declined"}</Chip>
            {canOffer && (
              <button onClick={() => onRespond(gameId, r.id, "accepted")} className="text-xs underline underline-offset-2" style={{ color: C.sub }}>Reconsider</button>
            )}
          </div>
        )}

        {r.status === "withdrawn" && (
          <div className="flex items-center gap-2">
            <Chip tone="amber" icon={<Bell size={12} />}>Asked the team · {r.parent} notified</Chip>
            {canOffer && (
              <button onClick={() => onRespond(gameId, r.id, "accepted")} className="text-xs underline underline-offset-2 inline-flex items-center gap-1" style={{ color: C.sub }}><Undo2 size={12} /> Undo</button>
            )}
          </div>
        )}
      </div>
      <PickupLine request={r} />
    </div>
  );
}

// ---- sidebar ----------------------------------------------------------------
function Sidebar() {
  const items = [{ icon: Calendar, label: "Calendar" }, { icon: Car, label: "Carpool", active: true }, { icon: Users, label: "Family" }];
  const settings = [{ icon: MapPin, label: "Places" }, { icon: Warehouse, label: "Garage" }, { icon: Rss, label: "Feeds" }];
  return (
    <div className="w-64 shrink-0 h-full flex flex-col justify-between px-4 py-6" style={{ background: C.sidebar }}>
      <div>
        <div className="flex items-center gap-2 px-2 mb-6">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: C.blue }} />
          <span className="text-white font-bold text-lg">App</span>
        </div>
        <div className="space-y-1">
          {items.map((it) => (
            <div key={it.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ background: it.active ? C.sidebarActive : "transparent", color: it.active ? "#fff" : "#9CA0AE" }}>
              <it.icon size={17} /> {it.label}
            </div>
          ))}
        </div>
        <div className="text-xs uppercase tracking-widest mt-6 mb-2 px-3" style={{ color: "#5C6070" }}>Settings</div>
        <div className="space-y-1">
          {settings.map((it) => (
            <div key={it.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: "#9CA0AE" }}>
              <it.icon size={17} /> {it.label}
            </div>
          ))}
        </div>
      </div>
      <div className="px-3 space-y-3">
        <div className="h-px" style={{ background: "#2A2C38" }} />
        <div className="flex items-center gap-2 text-sm">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#3A3D4A" }}>G</span>
          <div className="min-w-0">
            <div className="text-white truncate">test@example.c…</div>
            <div className="text-xs" style={{ color: "#8B8FA0" }}>Organizer</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: C.ring }}><LogOut size={15} /> Sign out</div>
      </div>
    </div>
  );
}

// ---- route tab ----------------------------------------------------------------
function RouteMap({ stops, apiKey }) {
  const src = embedUrl(stops, apiKey);
  if (src) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <iframe title="Carpool route" src={src} width="100%" height="280" style={{ border: 0 }} loading="lazy" />
      </div>
    );
  }
  return (
    <div className="rounded-2xl p-6" style={{ background: C.grayBg, border: `1px dashed ${C.border}` }}>
      <div className="flex items-start gap-3">
        <Info size={18} style={{ color: C.sub, marginTop: 2 }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>Live map needs a Google Maps API key</div>
          <div className="text-sm mt-1" style={{ color: C.sub }}>
            Add a free Maps Embed API key from Google Cloud Console (no billing charge for Embed usage) to show the
            route here. Stop order below is already computed — the map is just the visual.
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {stops.map((s, i) => (
          <React.Fragment key={s.name}>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "#fff", color: C.ink, border: `1px solid ${C.border}` }}>
              {s.kind === "home" && <Home size={12} />}
              {s.kind === "pickup" && <Users size={12} />}
              {s.kind === "destination" && <Flag size={12} />}
              {s.name}
            </div>
            {i < stops.length - 1 && <div className="w-4 h-px" style={{ background: C.border }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// "Channel-agnostic" on purpose: push infrastructure is planned but not live
// yet, so this always resolves to *some* channel today (SMS) and silently
// prefers push the moment a recipient has a token on file — no UI rework
// needed when push ships, just a different value in contact.channel.
function NotifyAction({ stop, time, state, onNotify }) {
  const channel = stop.contact.channel; // "push" | "sms" — as available today
  const ChannelIcon = channel === "push" ? Bell : MessageCircle;
  const channelLabel = channel === "push" ? "push notification" : "text message";

  if (state?.status === "sent") {
    return (
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1" style={{ background: C.greenBg, color: C.green }}>
          <Check size={12} /> Sent via {channelLabel} · {state.sentAt}
        </span>
        <button onClick={() => onNotify(stop)} className="text-xs underline underline-offset-2" style={{ color: C.sub }}>
          Resend
        </button>
      </div>
    );
  }

  if (state?.status === "sending") {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold mt-2 rounded-lg px-2.5 py-1" style={{ background: C.grayBg, color: C.sub }}>
        <Loader2 size={12} className="animate-spin" /> Sending…
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => onNotify(stop)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1 mt-2"
        style={{ background: C.grayBg, color: C.ink }}
      >
        <ChannelIcon size={12} /> Notify {toTime(time)} ready-by time
      </button>
      <div className="text-xs mt-1" style={{ color: C.sub }}>
        Will send to {stop.contact.to} via {channelLabel}
        {channel === "sms" ? " — no push token on file yet" : ""}
      </div>
    </div>
  );
}

function StopRow({ stop, time, isFirst, isLast, notifyState, onNotify }) {
  const label = isFirst ? "Leave by" : isLast ? "Arrive by" : "Be ready by";
  const Icon = stop.kind === "home" ? Home : stop.kind === "destination" ? Flag : Users;
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: isLast ? C.greenBg : C.blueBg }}>
          <Icon size={15} style={{ color: isLast ? C.green : C.blue }} />
        </div>
        {!isLast && <div className="w-px flex-1 mt-1" style={{ background: C.border }} />}
      </div>
      <div className="pb-6 min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="text-base font-semibold" style={{ color: C.ink }}>{stop.name}</div>
          <div className="text-sm font-semibold" style={{ color: C.sub }}>{label} <span style={{ color: C.ink }}>{toTime(time)}</span></div>
        </div>
        <div className="text-sm mt-0.5" style={{ color: C.sub }}>{stop.address}</div>
        {stop.kind === "pickup" && (
          <NotifyAction stop={stop} time={time} state={notifyState} onNotify={onNotify} />
        )}
      </div>
    </div>
  );
}

function RouteTab({ game, notifyStates, onNotify }) {
  const carpoolRoute = game.carpoolRoute;
  const eventStart = eventStartTime(game);
  const isPractice = game.opponent === "Practice";
  const { arriveBy, stopTimes } = useMemo(() => computeSchedule(carpoolRoute, eventStart), [carpoolRoute, eventStart]);
  const leaveBy = stopTimes[0];
  const apiKey = ""; // wire to real config in the actual app

  return (
    <div>
      {/* Leave-by hero */}
      <div className="rounded-2xl p-7 text-white relative overflow-hidden mb-6" style={{ background: C.heroGlow }}>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-2">
          <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(227,161,91,0.18)", color: C.ring }}>
            {isPractice ? "15 min early for practices" : "45 min early for games"}
          </span>
        </div>
        <div className="text-5xl font-bold leading-none mb-2">{toTime(leaveBy)}</div>
        <div className="text-gray-300 text-sm">
          Leave home to arrive at {game.rink} by {toTime(arriveBy)} — {carpoolRoute.bufferMinutes} min before {isPractice ? "practice starts" : "puck drop"} at {eventStart}
        </div>
        <a
          href={navigationUrl(carpoolRoute.stops)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold mt-5"
          style={{ background: "#fff", color: C.ink }}
        >
          <Navigation size={16} /> Start navigation
        </a>
      </div>

      {/* Map */}
      <div className="mb-6">
        <RouteMap stops={carpoolRoute.stops} apiKey={apiKey} />
      </div>

      {/* Stop-by-stop schedule */}
      <div className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: C.sub }}>Stop by stop</div>
      <div>
        {carpoolRoute.stops.map((s, i) => (
          <StopRow
            key={s.name}
            stop={s}
            time={stopTimes[i]}
            isFirst={i === 0}
            isLast={i === carpoolRoute.stops.length - 1}
            notifyState={notifyStates[s.name]}
            onNotify={onNotify}
          />
        ))}
      </div>
    </div>
  );
}

// ---- playlist tab ---------------------------------------------------------------
function InviteAction({ rider, state, onInvite }) {
  const channel = rider.contact.channel;
  const ChannelIcon = channel === "push" ? Bell : MessageCircle;
  const channelLabel = channel === "push" ? "push notification" : "text message";

  if (state?.status === "sent") {
    return (
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1" style={{ background: C.greenBg, color: C.green }}>
          <Check size={12} /> Invite sent via {channelLabel} · {state.sentAt}
        </span>
        <button onClick={() => onInvite(rider)} className="text-xs underline underline-offset-2" style={{ color: C.sub }}>Resend</button>
      </div>
    );
  }
  if (state?.status === "sending") {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold mt-2 rounded-lg px-2.5 py-1" style={{ background: C.grayBg, color: C.sub }}>
        <Loader2 size={12} className="animate-spin" /> Sending…
      </div>
    );
  }
  return (
    <button
      onClick={() => onInvite(rider)}
      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1 mt-2"
      style={{ background: C.grayBg, color: C.ink }}
    >
      <ChannelIcon size={12} /> Ask {rider.name} to add a playlist
    </button>
  );
}

function RiderTile({ rider, inviteState, onInvite }) {
  if (!rider.connected) {
    return (
      <div className="rounded-xl p-4" style={{ background: "#fff", border: `1px dashed ${C.border}` }}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: C.gray }}>{rider.name[0]}</span>
          <div>
            <div className="text-sm font-semibold" style={{ color: C.ink }}>{rider.name}</div>
            <div className="text-xs" style={{ color: C.sub }}>Hasn't added a playlist yet</div>
          </div>
        </div>
        <InviteAction rider={rider} state={inviteState} onInvite={onInvite} />
      </div>
    );
  }
  const totalSec = rider.tracks.reduce((n, t) => n + t.sec, 0);
  return (
    <div className="rounded-xl p-4" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: C.blue }}>{rider.name[0]}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{rider.name}</div>
          <div className="text-xs truncate" style={{ color: C.sub }}>{rider.playlistName} · {rider.tracks.length} songs · {fmtMinSec(totalSec)}</div>
        </div>
      </div>
    </div>
  );
}

function TrackRow({ track }) {
  return (
    <div className="flex items-center justify-between py-2 px-1" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: C.teal }}>{track.from[0]}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: C.ink }}>{track.title}</div>
          <div className="text-xs truncate" style={{ color: C.sub }}>{track.artist}</div>
        </div>
      </div>
      <div className="text-xs shrink-0 pl-3" style={{ color: C.sub }}>{fmtMinSec(track.sec)}</div>
    </div>
  );
}

function PlaylistTab({ game, inviteStates, onInvite, shuffleSeed, setShuffleSeed }) {
  const riders = game.carpoolRoute.playlistRiders;
  const driveMinutes = useMemo(() => game.carpoolRoute.legMinutes.reduce((a, b) => a + b, 0), [game]);

  const merged = useMemo(() => {
    const list = mergeTracks(riders);
    if (shuffleSeed === 0) return list;
    // simple seeded shuffle for the "remix order" affordance
    const arr = [...list];
    let seed = shuffleSeed;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [riders, shuffleSeed]);

  const totalSec = merged.reduce((n, t) => n + t.sec, 0);
  const driveSec = driveMinutes * 60;
  const coversDrive = totalSec >= driveSec;
  const connectedCount = riders.filter((r) => r.connected).length;
  const allConnected = connectedCount === riders.length;

  return (
    <div>
      {/* riders */}
      <div className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: C.sub }}>Who's in the car</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {riders.map((r) => (
          <RiderTile key={r.name} rider={r} inviteState={inviteStates[r.name]} onInvite={onInvite} />
        ))}
      </div>

      {/* merged playlist hero */}
      <div className="rounded-2xl p-7 text-white relative overflow-hidden mb-6" style={{ background: C.heroGlow }}>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-2">
          <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(227,161,91,0.18)", color: C.ring }}>
            Merged from {connectedCount} playlist{connectedCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <div className="text-4xl font-bold leading-none">{fmtMinSec(totalSec).split(":")[0]} min</div>
          <div className="text-gray-300 text-sm">of music queued</div>
        </div>
        <div className="text-sm" style={{ color: coversDrive ? "#8FE3B0" : C.ring }}>
          {coversDrive
            ? `Covers the ~${driveMinutes} min drive with room to spare`
            : `Drive is ~${driveMinutes} min — add more songs to fill it`}
        </div>
        {!allConnected && (
          <div className="text-xs text-gray-400 mt-1">Only counting riders who've connected so far — {riders.filter((r) => !r.connected).map((r) => r.name).join(", ")} isn't included yet</div>
        )}
        <div className="flex gap-3 mt-5 flex-wrap">
          <a
            href="https://open.spotify.com/playlist/carpool-demo"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold"
            style={{ background: "#fff", color: C.ink }}
          >
            <Play size={16} /> Open in Spotify
          </a>
          <button
            onClick={() => setShuffleSeed((s) => s + 1)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            <Shuffle size={16} /> Remix merge order
          </button>
        </div>
      </div>

      {/* premium caveat */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: C.grayBg, border: `1px dashed ${C.border}` }}>
        <div className="flex items-start gap-3">
          <Info size={17} style={{ color: C.sub, marginTop: 2 }} />
          <div className="text-sm" style={{ color: C.sub }}>
            <span style={{ color: C.ink, fontWeight: 600 }}>This builds the playlist automatically, but doesn't press play for you. </span>
            Spotify's free-tier API can create and merge playlists for any account. Remotely starting playback on
            the car's speakers needs Spotify Connect, which requires the driver to have Premium. To stay free for
            everyone, "Open in Spotify" hands the merged queue to the driver's phone — they tap play like normal.
          </div>
        </div>
      </div>

      {/* tracklist */}
      <div className="text-sm font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: C.sub }}>
        <Music size={13} /> Merge order
      </div>
      <div className="rounded-2xl p-4" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
        {merged.map((t, i) => (
          <TrackRow key={`${t.title}-${i}`} track={t} />
        ))}
      </div>
    </div>
  );
}

// ---- detail screen (route / playlist for one game) ---------------------------
function DetailScreen({ game, tab, setTab, onBack, notifyStates, onNotify, inviteStates, onInvite, shuffleSeed, setShuffleSeed }) {
  const title = game.opponent === "Practice" ? `${game.team} · Practice` : `${game.team} vs ${game.opponent}`;
  return (
    <div className="flex h-full w-full" style={{ background: C.page, minHeight: 820 }}>
      <Sidebar />
      <div className="flex-1 overflow-auto px-10 py-8 max-w-2xl">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold mb-5" style={{ color: C.sub }}>
          <ArrowLeft size={15} /> Back to schedule
        </button>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: C.sub }}>{game.date} · {game.time}</div>
            <h1 className="text-2xl font-bold" style={{ color: C.ink }}>{title}</h1>
          </div>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: C.grayBg }}>
            <button
              onClick={() => setTab("route")}
              className="text-xs font-semibold rounded-lg px-3.5 py-1.5"
              style={tab === "route" ? { background: "#fff", color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" } : { color: C.sub }}
            >
              Route
            </button>
            <button
              onClick={() => setTab("playlist")}
              className="text-xs font-semibold rounded-lg px-3.5 py-1.5"
              style={tab === "playlist" ? { background: "#fff", color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" } : { color: C.sub }}
            >
              Playlist
            </button>
          </div>
        </div>

        {tab === "route" ? (
          <RouteTab game={game} notifyStates={notifyStates} onNotify={onNotify} />
        ) : (
          <PlaylistTab game={game} inviteStates={inviteStates} onInvite={onInvite} shuffleSeed={shuffleSeed} setShuffleSeed={setShuffleSeed} />
        )}
      </div>
    </div>
  );
}

// ---- home screen (hero + weekly list) ------------------------------------------
function HomeScreen({ sorted, queue, openCount, focusedGameId, handlers, onOpenRide }) {
  return (
    <div className="flex h-full w-full" style={{ background: C.page, minHeight: 820 }}>
      <Sidebar />
      <div className="flex-1 overflow-auto px-10 py-8">
        <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.sub }}>Needs your attention</div>
        <HeroCarousel queue={queue} openCount={openCount} handlers={handlers} />
        <div className="text-xs uppercase tracking-widest font-semibold mt-10 mb-3" style={{ color: C.sub }}>This week</div>
        <div className="space-y-3 pb-10">
          {sorted.map((g) => (
            <GameCard key={g.id} game={g} isFocused={g.id === focusedGameId} handlers={handlers} onOpenRide={onOpenRide} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- app root -----------------------------------------------------------------
export default function App() {
  const [gamesRaw, setGamesRaw] = useState(initialGames);
  // Every mutation passes through this wrapper so the "can't offer a ride I
  // don't have" invariant can never drift out of sync — it's enforced once,
  // centrally, rather than re-checked in every individual handler.
  const setGames = (updater) =>
    setGamesRaw((gs) => autoDeclineUnofferable(typeof updater === "function" ? updater(gs) : updater));

  const onAssign = (gameId, driver, confirmed) =>
    setGames((gs) => gs.map((g) => {
      if (g.id !== gameId) return g;
      if (driver === "unassigned") return { ...g, ownRide: "unassigned" };
      return { ...g, ownRide: { driver, confirmed }, attendance: "going" };
    }));

  const onAskTeam = (gameId) => setGames((gs) => gs.map((g) => (g.id === gameId ? { ...g, ownRide: "requested" } : g)));

  const onRespond = (gameId, reqId, status) =>
    setGames((gs) => gs.map((g) => (g.id === gameId ? { ...g, requests: g.requests.map((r) => (r.id === reqId ? { ...r, status, autoDeclined: status === "declined" ? r.autoDeclined : false } : r)) } : g)));

  const onWithdraw = (gameId, reqId) => onRespond(gameId, reqId, "withdrawn");

  const onCantMakeIt = (gameId) =>
    setGames((gs) => gs.map((g) => (
      g.id === gameId
        ? { ...g, ownRide: "unassigned", requests: g.requests.map((r) => (r.status === "accepted" ? { ...r, status: "withdrawn" } : r)) }
        : g
    )));

  const onSetAttendance = (gameId, attendance) => setGames((gs) => gs.map((g) => (g.id === gameId ? { ...g, attendance } : g)));

  const handlers = { onAssign, onAskTeam, onRespond, onWithdraw, onCantMakeIt, onSetAttendance };

  const queue = useMemo(() => getQueue(gamesRaw), [gamesRaw]);
  const openCount = queue.length;
  const focusedGameId = queue[0]?.game.id ?? null;
  const sorted = [...gamesRaw].sort((a, b) => a.order - b.order);

  // ---- navigation between home <-> per-game detail (route / playlist) -----
  const [nav, setNav] = useState({ screen: "home" });
  const [tab, setTab] = useState("route");
  const [notifyStates, setNotifyStates] = useState({});
  const [inviteStates, setInviteStates] = useState({});
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const onOpenRide = (gameId) => {
    setTab("route");
    setShuffleSeed(0);
    setNav({ screen: "detail", gameId });
  };
  const onBack = () => setNav({ screen: "home" });

  // Simulates the real send — in production this posts to a notification
  // service that tries push first and falls back to SMS per-recipient;
  // here it just reflects whatever channel is already on the mock contact.
  const handleNotify = (stop) => {
    setNotifyStates((s) => ({ ...s, [stop.name]: { status: "sending" } }));
    setTimeout(() => {
      setNotifyStates((s) => ({
        ...s,
        [stop.name]: { status: "sent", sentAt: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) },
      }));
    }, 700);
  };
  const handleInvite = (rider) => {
    setInviteStates((s) => ({ ...s, [rider.name]: { status: "sending" } }));
    setTimeout(() => {
      setInviteStates((s) => ({
        ...s,
        [rider.name]: { status: "sent", sentAt: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) },
      }));
    }, 700);
  };

  if (nav.screen === "detail") {
    const game = gamesRaw.find((g) => g.id === nav.gameId);
    if (game) {
      return (
        <DetailScreen
          game={game}
          tab={tab}
          setTab={setTab}
          onBack={onBack}
          notifyStates={notifyStates}
          onNotify={handleNotify}
          inviteStates={inviteStates}
          onInvite={handleInvite}
          shuffleSeed={shuffleSeed}
          setShuffleSeed={setShuffleSeed}
        />
      );
    }
  }

  return (
    <HomeScreen
      sorted={sorted}
      queue={queue}
      openCount={openCount}
      focusedGameId={focusedGameId}
      handlers={handlers}
      onOpenRide={onOpenRide}
    />
  );
}
