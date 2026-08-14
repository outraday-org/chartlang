---
"@invinite-org/chartlang-runtime": minor
---

`session.isOpen` becomes calendar-aware for scripts

The script-facing `session.*` is a separate implementation from the host-facing
`core/time` helpers, so teaching only the latter about holidays would have left
every chartlang script still seeing a full session on a half day. This closes
that half.

`CreateScriptRunnerArgs.sessionCalendar` takes exchange-calendar ROWS (the
`SessionCalendarDay[]` both hosts send on their `load` frame — a `lookup()`
object cannot cross either membrane). `createScriptRunner` builds the
`SessionCalendar` once at mount and hangs it on `RuntimeContext`, where
`buildSessionNamespace` picks it up. Private deps, drawn siblings, and
`request.security` expression runners inherit it, so a composed bundle answers
one way.

`createSessionNamespace(getDefaultTz, onDstUnsupported, calendar?)` derives its
day key from the SAME `splitEpoch(t, offsetMin)` call the minute-of-day comes
from — never from `core/time`'s `nyDayKey`, which uses `Intl`. The accessor's
"no `Date`, no `Intl`, byte-reproducible across hosts" contract is intact. A
`closed` day is never open; a `halfDay` caps membership at the early close
(exactly `min(specEnd, closeMinutes)` for an ordinary window; for a
midnight-wrap window the early close ends the day, so the evening arm goes
too). No calendar, or a day it does not mention, leaves the answer unchanged.
