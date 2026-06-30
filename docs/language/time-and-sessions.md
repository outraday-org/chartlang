# Time and sessions

Scripts read the bar timestamp from `bar.time` and break it into calendar
fields — year, month, day, weekday, hour, minute, second — through the
[`time.*`](../primitives/time.md) accessor namespace, and test session-window
membership through [`session.*`](../primitives/session.md). This page documents
the **determinism contract** these accessors hold and the Pine conventions
they follow.

## `bar.time` is a UTC ms epoch

`bar.time` is the bar's open timestamp as **milliseconds since the Unix epoch,
in UTC** — a plain `number`. It is a scalar (unlike `bar.close`, which is a
series), so you pass it straight to the accessors:

```ts
compute({ bar, time, session }) {
    const t = bar.time;

    const y   = time.year(t);        // 2024
    const mo  = time.month(t);       // 1..12
    const d   = time.dayofmonth(t);  // 1..31
    const dow = time.dayofweek(t);   // 1=Sun .. 7=Sat (Pine convention)
    const hh  = time.hour(t);        // 0..23
    const mm  = time.minute(t);      // 0..59
    const ss  = time.second(t);      // 0..59

    const inRTH = session.isOpen(t, "0930-1600");
    void [y, mo, d, dow, hh, mm, ss, inRTH];
}
```

`time.timestamp(year, month, day, hour?, minute?, second?, tz?)` builds an
epoch from calendar fields, and `time.timeClose(t)` returns the **close**
timestamp of the bar that opens at `t` (Pine's no-arg `time_close()` =
`t + the current bar's interval`). `time.now()` returns the host-injected
wall-clock epoch at call time; tests and deterministic replays should inject a
fixed clock when they depend on it.

## Do not use `Date` or `Intl`

`Date` and `Intl` are **forbidden hostile globals** on the script path — they
read the host clock / host ICU tables and break replay determinism. Use
`time.now()` for the explicit host-provided wall clock instead of `Date.now`.
The compiler rejects `Date` (and pins `lib: ["lib.es2022.d.ts"]` so `Intl` is not
even in scope). The host owns the epoch math; the script only ever names
`bar.time` and the `time.*` / `session.*` accessors. See
[Forbidden constructs](./forbidden-constructs.md).

## v1 is UTC + fixed-offset only

Every accessor takes an optional trailing `tz` argument. The default is
`syminfo.timezone` (falling back to `"UTC"` when that is empty). **v1 resolves
UTC and fixed-offset zones only** — `"UTC"`, `"Etc/UTC"`, and an explicit
`±HH:MM` offset are honoured exactly with pure integer epoch arithmetic, so the
output is **byte-reproducible across hosts**.

A real IANA zone with daylight-saving transitions (e.g.
`"America/New_York"`) is **deliberately resolved to UTC** and raises a
one-time `tz-dst-unsupported` diagnostic, rather than being silently resolved
through `Intl`. This is intentional: there is no self-contained timezone
database in the runtime, and `Intl` output varies by the host's ICU / tz-data
version — a cross-host reproducibility hazard. It is the same reason
`ta.sessionVolumeProfile` does UTC-only session math and the same reason
`Date` is banned. Exchange-timezone + DST correctness is a scoped follow-up
(see below).

## `dayofweek` follows Pine's `1=Sun .. 7=Sat`

`time.dayofweek(t)` returns Pine's convention — **`1` is Sunday and `7` is
Saturday** — NOT the ISO `1=Monday` convention. A Monday-through-Friday filter
is `dow >= 2 && dow <= 6`.

## Sessions

`session.isOpen(t, spec, tz?)` is `true` when `t` falls inside the daily
session window `spec`, an `"HH:MM-HH:MM"` (or `"HHMM-HHMM"`) intraday window
such as `"0930-1600"`. The window is interpreted in `tz` under the same
UTC + fixed-offset contract above. The spec can be a script setting via
[`input.session`](../primitives/input/session.md):

```ts
inputs: {
    sess: input.session("0930-1600", { title: "Session" }),
},
compute({ bar, session, inputs, plot }) {
    plot(session.isOpen(bar.time, inputs.sess as string) ? bar.close : Number.NaN);
}
```

## Deferred

A full IANA-zone accessor needs either a determinism contract that **pins an
ICU / tz-data version** (so `Intl` output is reproducible across hosts) or a
**bundled, vetted offset/transition table**. Until then a DST zone resolves to
UTC + `tz-dst-unsupported`. See the
[Versioning spec](../spec/versioning.md) for the reproducibility guarantees.
