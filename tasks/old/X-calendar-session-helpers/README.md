# Calendar / time accessors + session helpers — `time.*` / `session.*` / `input.session`

## Overview

Give script authors **calendar fields** and **session membership** derived
from `bar.time`, the way Pine exposes `year` / `month` / `dayofmonth` /
`dayofweek` / `hour` / `minute` / `second`, `time()` / `time_close()`, and
`input.session`. Today an author holding `bar.time` (UTC ms epoch,
`packages/core/src/types.ts:24`) has **no sanctioned way** to break it into
calendar parts: `Date` is a forbidden hostile global
(`packages/compiler/src/analysis/forbiddenConstructs.ts:9`, with `Date.*` and
bare `Date` both rejected at `:161`/`:164`), and `program.ts` pins
`lib: ["lib.es2022.d.ts"]` so even `Intl` is out of reach on the author path.
The `timeframe.*` view (`packages/core/src/views/timeframe.ts:18`) only carries
period + `isintraday/isdaily/isweekly/ismonthly` + `inSeconds` — **no calendar
fields** — and `syminfo.*` (`packages/core/src/views/syminfo.ts:44-45`) carries
only the raw `timezone` / `session` strings (default `""`).

The host *does* own real calendar machinery — `packages/core/src/time/`
(`weekday.ts`, `nyDayKey.ts:localDateParts`, `sessionBoundaries.ts:isOpen`, all
through `_lib/dateTimeFormatCache.ts`'s `Intl.DateTimeFormat`) — but that folder
is **never re-exported from `packages/core/src/index.ts`** (no `./time` line in
the barrel, confirmed), so scripts cannot reach it, and it is `Intl`-backed, so
its output varies by host ICU/tz-data version. We deliberately do **not** put
that on the author path.

```ts
compute({ bar, syminfo }) {
    const t = bar.time.current;

    const y   = time.year(t);        // 2024
    const mo  = time.month(t);       // 1..12
    const d   = time.dayofmonth(t);  // 1..31
    const dow = time.dayofweek(t);   // 1=Sun .. 7=Sat (Pine convention)
    const hh  = time.hour(t);        // 0..23
    const mm  = time.minute(t);      // 0..59

    // membership in an "HH:MM-HH:MM" window (UTC-first cut):
    const inRTH = session.isOpen(t, "0930-1600");

    plot(inRTH && dow >= 2 && dow <= 6 ? bar.close : Number.NaN);
}
```

A new `input.session("0930-1600")` kind lets that window be a script setting.

### Why it matters

`dayofweek` / `time()` / `input.session` are pervasive Pine idioms — session
filters, day-of-week gating, intraday "first N minutes" logic. The Pine
converter cannot lower them today (`packages/pine-converter/src/semantic/builtins.ts`
lists `time`/`time_close`/`dayofweek`/`session` as known builtins at `:38-39`,
`:151-152`, but there is no chartlang target to map them to). This work is that
target.

### Architecture: who owns Date/Intl

The accessors are implemented as **runtime primitives on a frozen `time` /
`session` namespace** that the runtime installs on `ComputeContext` (exactly
like `ta` — `packages/runtime/src/buildComputeContext.ts:34`). The author calls
`time.year(t)`; the runtime function does the epoch math. The author never
names `Date` or `Intl`, so the sandbox holds. These are **stateless pure
functions** of `(t, tz?)` — they are **not** a per-bar refreshed view like
`timeframe.*`/`syminfo.*` (`packages/runtime/src/views/index.ts`), and they
allocate **no slot** (`slot: false`, like `ta.nz` —
`packages/core/src/statefulPrimitives.ts:114`), so there is no callsite-id
injection.

The hard problem is **timezone/DST determinism** — see Architecture Decisions.

References: `packages/core/CLAUDE.md` (sentinel holes, `STATEFUL_PRIMITIVES`
additive rule), `packages/core/src/time/CLAUDE.md` (pure-over-explicit-args,
explicit `timeZone`), `packages/compiler/CLAUDE.md` (ambient-shim lockstep, no
DOM lib, hostile globals), `packages/runtime/CLAUDE.md` (`primitives.ts` swap
seam, `sessionVolumeProfile` UTC-only precedent),
`packages/pine-converter/CLAUDE.md` (builtin mapping).

## Current State

- `bar.time` is UTC ms epoch (`Time = number`, `packages/core/src/types.ts:24`;
  `Bar.time`, `:87`). `BarSeries.time` stays a scalar `Time`.
- `timeframe.*` (`packages/core/src/views/timeframe.ts:18-50`) has
  `period` + `isintraday/isdaily/isweekly/ismonthly` + `inSeconds`. **No
  calendar fields.**
- `syminfo.*` (`packages/core/src/views/syminfo.ts:37-47`) has raw
  `timezone` / `session` strings; both default `""` (`:67-68`). `timezone` IS
  available at runtime — `createScriptRunner.ts:286` builds the view from
  `args.symInfo`; `buildComputeContext.ts:41` hands it to the script.
- `packages/core/src/time/` (`weekday.ts:18`, `nyDayKey.ts:localDateParts:26`,
  `sessionBoundaries.ts:isOpen:134` using `Date.UTC`/`Intl` at `:33`/`:52`,
  `_lib/dateTimeFormatCache.ts:16` `Intl.DateTimeFormat`) is host-only and
  **not exported** from `packages/core/src/index.ts` — authors cannot reach it.
- `Date` is rejected (`forbiddenConstructs.ts:9` set, `:161` `Date.*`, `:164`
  bare `Date`); `program.ts` pins `lib: ["lib.es2022.d.ts"]` (compiler CLAUDE
  "No DOM lib") so `Intl` is unavailable to scripts.
- `ta.sessionVolumeProfile` (`packages/runtime/src/ta/sessionVolumeProfile.ts`)
  already parses `syminfo.session` as an `HH:MM-HH:MM` window
  (`parseSessionWindowMinutes:85`) with **UTC-only** arithmetic, falling back
  with a `session-info-missing` diagnostic (`:111-119`) — the deliberate
  determinism precedent that avoids `Intl`.
- `input.*` kinds: core `InputKind` union (`input/inputDescriptor.ts:16-28`) +
  per-kind descriptors (`:100-235`) + builders (`input/input.ts:34-233`);
  compiler `INPUT_KINDS` (`analysis/extractInputs.ts:17`) + `KIND_TO_WIRE`
  (`:33`); `program.ts` shim `InputKind` (`:914`) + per-kind descriptors +
  `input` decl (`:973`); adapter-kit `InputKind = CoreInputKind`
  (`adapter-kit/src/types.ts:155`) — all in lockstep.
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`) carries
  `ta.nz` as the lone stateless `slot: false` precedent (`:114`); the runtime
  installs `ta` by identity from `primitives.ts:27`.
- Pine converter `builtins.ts` knows `time`/`time_close` (`:38-39`),
  `dayofweek`/`session` (`:151-152`) but has no lowering target.

## Target State

- A new script-facing **`time` namespace** on `ComputeContext`:
  `time.year(t, tz?)`, `time.month`, `time.dayofmonth`, `time.dayofweek`,
  `time.hour`, `time.minute`, `time.second`, plus `time.timestamp(y, mo, d,
  hh?, mm?, ss?, tz?)`. Each takes a `Time` and an optional IANA `tz` string;
  default `tz = syminfo.timezone` (fallback `"UTC"`). `dayofweek` follows
  Pine's `1=Sun..7=Sat` convention (documented).
- A new **`session` namespace**: `session.isOpen(t, spec, tz?)` where `spec`
  is an `"HH:MM-HH:MM"` (or `"HHMM-HHMM"`) string, reusing the
  `sessionVolumeProfile` UTC string-parse path.
- A new **`input.session(default, opts?)`** kind producing a
  `SessionDescriptor { kind: "session", defaultValue: string }`, wired across
  core + compiler (extract + shim) + adapter-kit + the ambient shim.
- Both namespaces are **stateless `slot: false`** registry entries; the
  runtime installs frozen `time` / `session` objects on `ComputeContext`,
  defaulting `tz` from `views.syminfo.timezone`.
- **First cut is UTC + fixed-offset only**, pure integer epoch arithmetic
  (Howard Hinnant `civil_from_days`), **no `Date`/`Intl` on the author path** —
  byte-reproducible across hosts. Exchange-tz + DST is an explicitly-scoped
  **follow-up** (Deferred).
- Conformance scenario(s) over a fixed UTC fixture pin calendar fields +
  session membership; goldens regenerated.
- Docs (new `time` / `session` primitive pages + the determinism contract),
  the chartlang-coding skill (regenerated `primitives.md`), an example script +
  demo entry, and the pine-converter mapping for `dayofweek`/`time()`/
  `input.session` all show the feature.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **`time.*` / `session.*` are a NEW namespace, not an extension of `timeframe.*`.** | `timeframe.*` is a per-bar frozen *view* of the current bar's interval (`makeTimeframeView`); calendar accessors are pure functions of an arbitrary `(t, tz)` and must work on `bar.time`, `input.time(...)`, or any computed epoch — not just "this bar." Bolting them onto `timeframe.*` would force a per-bar snapshot of fields that are really functions of an argument. |
| **Implemented as runtime primitives, registered `slot: false`.** | The host must own any `Date`/`Intl` machinery so authors stay sandboxed (`Date`/`Intl` banned on the author path). They are stateless pure functions — no per-callsite state — so they take **no** injected slot id, exactly like `ta.nz` (`statefulPrimitives.ts:114`, `slot: false`). They still ride the registry so `stateful-call-inside-loop` (Pine-parity) governs them. |
| **Installed on `ComputeContext` as frozen objects (like `ta`), not a refreshed view.** | `time`/`session` need no per-bar refresh — their inputs are explicit arguments. `buildComputeContext.ts` adds two frozen namespaces alongside `ta`; the only per-mount data they close over is `syminfo.timezone` for the default `tz`. |
| **HARDEST: UTC + fixed-offset FIRST CUT, pure integer epoch arithmetic; exchange-tz/DST deferred.** | There is **no self-contained tz database in the runtime**, and `Intl` output varies by host ICU/tz-data version — a cross-host reproducibility hazard. That is exactly *why* `sessionVolumeProfile` does UTC-only math and *why* `Date` is banned. So v1 ships `civil_from_days` (Howard Hinnant, ~10 lines, zero deps, byte-reproducible: `days→y/m/d`, plus `secs→hh/mm/ss`) and treats a fixed numeric offset (from a tz that is `"UTC"`, `"Etc/UTC"`, or an explicit `±HH:MM`) as a pre-shift of the epoch. A real IANA zone with DST is **rejected to UTC + a one-time `tz-dst-unsupported` diagnostic** (mirroring `session-info-missing`), NOT silently `Intl`-resolved. Exchange-tz + DST correctness is a scoped follow-up that either **pins an ICU/tz-data version into the determinism contract** or **bundles a vetted offset table** — see Deferred. |
| **`session.isOpen` reuses the `sessionVolumeProfile` UTC string-parse path.** | `parseSessionWindowMinutes` already parses `"HH:MM-HH:MM"` / `"HHMM-HHMM"` to start/end minutes with UTC-only arithmetic and a missing-info diagnostic. Lift that parse into a shared helper rather than forking a second parser — one source of truth for the session-window grammar. |
| **`dayofweek` uses Pine's `1=Sun..7=Sat`.** | Pine-parity is the point. The host `weekday.ts` uses `0=Sun`; the new accessor maps to `1..7` and documents it. (We do not reuse `weekday.ts` — it is `Intl`-backed; the UTC accessor derives weekday from the integer day count.) |
| **`input.session` is a plain string descriptor (`kind: "session"`, default `"0930-1600"`).** | It is an `"HH:MM-HH:MM"` spec — structurally a constrained string, mirroring `input.string`. No calendar picker UI in v1 (deferred); the wire tag is `"session"`. |

## Dependency Graph

```
Task 1 (core: time.* / session.* namespace types + holes + registry + barrel + shim)
  |
  v
Task 2 (runtime: UTC/fixed-offset civil_from_days impl + install on ComputeContext)
  |
Task 3 (input.session kind: core + compiler extract/shim + adapter-kit)  [parallel to 2]
  |
  v
Task 4 (runtime: session.isOpen reusing the UTC session-window parser)
  |
  v
Task 5 (conformance: calendar fields + session membership on a fixed UTC fixture + goldens)
  |
  v
Task 6 (docs + skills regenerate + example + demo + pine-converter mapping)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core `time.*` / `session.*` namespace + registry + shim](./1-core-time-session-namespace.md) | core, compiler | None | Medium |
| 2 | [Runtime UTC/fixed-offset calendar impl](./2-runtime-calendar-impl.md) | runtime | 1 | High |
| 3 | [`input.session` kind across core + compiler + adapter-kit](./3-input-session-kind.md) | core, compiler, adapter-kit | 1 | Medium |
| 4 | [Runtime `session.isOpen` helper](./4-runtime-session-isopen.md) | runtime | 1, 2, 3 | Medium |
| 5 | [Conformance: calendar + session scenarios](./5-conformance-scenarios.md) | conformance | 2, 4 | Low |
| 6 | [Docs, skills, example, pine-converter mapping](./6-docs-skills-converter.md) | docs, skills, apps/site, examples, pine-converter | 1–5 | Medium |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `ta.nz` stateless registration | `packages/core/src/statefulPrimitives.ts:114` | The `slot: false` precedent for the new `time.*` / `session.*` entries. |
| `ta` install on `ComputeContext` | `packages/runtime/src/primitives.ts:27`, `buildComputeContext.ts:34` | Pattern for installing a frozen runtime namespace. |
| `syminfo.timezone` at runtime | `createScriptRunner.ts:286`, `buildComputeContext.ts:41`, `views/symInfoView.ts` | Source of the default `tz`. |
| `parseSessionWindowMinutes` | `packages/runtime/src/ta/sessionVolumeProfile.ts:85` | The `"HH:MM-HH:MM"` parser to lift into a shared helper for `session.isOpen`. |
| `session-info-missing` diagnostic | `packages/runtime/src/ta/sessionVolumeProfile.ts:111-119` | Template for the `tz-dst-unsupported` / missing-session diagnostic. |
| `input.*` descriptor + builder + extract + shim chain | `core/src/input/{inputDescriptor,input}.ts`, `compiler/src/analysis/extractInputs.ts:17,33`, `program.ts:914,973`, `adapter-kit/src/types.ts:155` | The five lockstep edit sites for a new input kind. |
| `barCloseDirectIndex.scenario.ts` | `packages/conformance/src/scenarios/` | Scenario shape to mirror. |
| `builtins.ts` known-builtin lists | `packages/pine-converter/src/semantic/builtins.ts:38-39,151-152` | `time`/`time_close`/`dayofweek`/`session` already known; add the lowering. |
| `gen-examples-docs.ts` / `generate-skills-reference.ts` / `DEMO_SCRIPTS` | `scripts/`, `apps/site/src/components/demo/scripts.ts` | Generated docs + skills reference + demo entry. |

## Provenance

chartlang-native ergonomics **plus** Pine-parity (`year`/`month`/`dayofmonth`/
`dayofweek`/`hour`/`minute`/`second`, `time()`/`time_close()`, `input.session`).
The UTC civil-date math is the standard Howard Hinnant `civil_from_days`
algorithm (public-domain reference); the session-window parser is lifted from
the existing in-repo `sessionVolumeProfile` port.

## Deferred / Follow-Up Work

- **Exchange-tz + DST correctness.** The v1 cut is UTC + fixed-offset only. A
  full IANA-zone accessor needs either a determinism contract that **pins an
  ICU/tz-data version** (so `Intl` output is reproducible across hosts) or a
  **bundled, vetted offset/transition table**. Until then a DST zone resolves
  to UTC + a `tz-dst-unsupported` diagnostic.
- ~~**`time_close()`** — the bar-CLOSE timestamp (start + interval). Needs the
  interval-aware close instant; deferred until a clear use case beyond
  `bar.time + intervalToSeconds(...) * 1000`.~~ **UN-DEFERRED** — the aggregate
  `tasks/future/README.md` and `tasks/future/pine-converter-coverage/README.md`
  fold `time_close` into this folder (the pine-converter capstone depends on
  it). Shipped as `time.timeClose(t, tz?)` (= bar start + the current bar's
  `timeframe.inSeconds`): core hole + registry entry + shim in Task 1, runtime
  impl in Task 2, converter mapping in Task 6.
- **Calendar-based `input` pickers** — a real date/time/session picker UI hint
  (`pickFromChart`-style) for `input.session`. v1 ships the string descriptor
  only.
- **`time.weekofyear` / `time.dayofyear`** and other secondary Pine calendar
  builtins, once the UTC base is proven.
