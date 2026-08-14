# Core Time Helpers

- Public helpers must be pure over explicit `Time` and `tz` arguments.
- Do not read the host default timezone. Use `Intl.DateTimeFormat` with an explicit `timeZone`.
- Ported files keep the workspace provenance header with source path and commit.
- Reuse `_lib/dateTimeFormatCache.ts` for formatter construction.

## `sessionCalendar.ts` — the one root-exported module here

Everything else in this folder is `Intl`-based and reaches consumers only
through the `./time` subpath. `sessionCalendar.ts` is pure data (zero imports,
no `Intl`, no `Date`), so the package ROOT barrel re-exports it too — that is
what lets the runtime accessor and both host protocols use the same type
without dragging `Intl` into the runtime or the QuickJS dispatcher bundle.
Do not export any other `src/time/` module from the root.

**chartlang owns the interface, the consumer owns the rows.** No holiday data
ships here. Rows cross the worker / QuickJS membrane as JSON, which is why the
WIRE form is `SessionCalendarDay[]` and the `lookup()` interface is built on the
far side by `createSessionCalendar`.

- `closeMinutes` is a **LOCAL exchange minute-of-day**, never UTC. It flows into
  the same `zonedTimeToUtcMs` conversion the fixed window uses, so DST is solved
  once, in `sessionBoundaries.ts`. A UTC minute here would re-open that problem.
- **Weekend first, calendar second.** `sessionFor` returns `null` for Sat/Sun
  before it looks anything up, so a row for a Saturday is inert, not
  contradictory.
- **Unknown day key fails open** and never throws. The only rejection is at
  CONSTRUCTION: a `halfDay` whose `closeMinutes` is not an integer in
  `[0, 1440]`.
- **An early close truncates BOTH the regular and the extended window**
  (`min(windowEnd, closeMinutes)`). chartlang deliberately does not synthesise a
  post-early-close after-hours tail — the consumer supplies exactly one close
  minute per day, so any "close + 4h" would be fabricated data.
- `nySessionBounds` is non-nullable, so a `closed` day falls into the SAME
  synthetic noon-centred window a weekend already takes. Callers that need
  "no session" use `regularSession` / `extendedSession`.

The script-facing `session.isOpen` is a SEPARATE, deliberately `Intl`-free
implementation in `runtime/src/time-accessors/sessionAccessors.ts`; it consumes
the same rows and derives its day key from `splitEpoch`. Changing the row shape
means changing both halves plus both host `load` frames.
