---
"@invinite-org/chartlang-core": minor
---

`SessionCalendar`: pluggable holiday / half-day awareness for the session helpers

Until now no part of chartlang knew a market holiday from a Tuesday, so the
~13 US half days a year read as full sessions and a post-13:00 Black Friday
tick counted as regular session.

`packages/core/src/time/sessionCalendar.ts` adds the interface — chartlang owns
it, the consumer owns the data:

- `SessionCalendarDay` — one exception day, discriminated on `kind`:
  `{ dayKey, kind: "closed" }` or `{ dayKey, kind: "halfDay", closeMinutes }`.
  `dayKey` is the local `"YYYY-MM-DD"` key; `closeMinutes` is a **local
  exchange minute-of-day**, not UTC, so it flows through the same wall-clock
  conversion that already solves DST.
- `SessionCalendar` — the O(1) `lookup(dayKey)` handle.
- `createSessionCalendar(days)` — builds it once, and REJECTS a `halfDay`
  whose `closeMinutes` is not an integer in `[0, 1440]` rather than failing
  open later.

`nySessionBounds`, `regularSession`, `extendedSession`, `isOpen` and the frozen
`session` namespace each take the calendar as an optional trailing argument
(never module state). Omit it and behaviour is byte-identical — asserted by a
property test over arbitrary zones and instants, not just a few dates. A
`closed` day yields no session; a `halfDay` truncates the window end, including
the extended window, because the consumer supplies exactly one close minute and
synthesising an after-hours tail would be fabricated data. The weekend branch
still runs first, so a row for a Saturday is inert, and a day the calendar does
not mention is unchanged.

The rows are the WIRE form on purpose: a `lookup()` method cannot cross a
worker or QuickJS membrane, so both hosts carry `SessionCalendarDay[]` on their
`load` frame and rebuild the interface on the far side. Because both the
host-facing predicates and the script-facing runtime accessor need the shape,
`sessionCalendar.ts` is the one `src/time/` module the package root barrel
exports — it is pure data and drags no `Intl` into the runtime bundle.
