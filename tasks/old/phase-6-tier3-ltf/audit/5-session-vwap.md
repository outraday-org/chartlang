# Session VWAP Audit

- Pine source shape: session-aware VWAP reset on market open.
- chartlang port: import `session`, `nyDayKey`, and `weekKey` from `@invinite-org/chartlang-core/time`.
- Trace: Pine implicit exchange timezone maps to explicit `tz` arguments.
- Gap: custom exchange calendars beyond weekday sessions are adapter/user code.
