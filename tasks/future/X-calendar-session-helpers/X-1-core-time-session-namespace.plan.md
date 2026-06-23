# Plan — Task 1: Core `time.*` / `session.*` namespace + registry + compiler shim

## Context

Add two new script-facing namespaces in core — `time` (calendar accessors) and
`session` (`isOpen`) — as frozen objects of **sentinel holes**, wire them onto
`ComputeContext`, re-export from the package root, append their entries to
`STATEFUL_PRIMITIVES` as **`slot: false`** (stateless, like `ta.nz`), and mirror
all of it in the compiler's ambient shim (`program.ts`) in lockstep. Plus
type-level + hole-throw tests + a feature changeset. **Core surface only** —
runtime impl is Task 2, `session.isOpen` impl is Task 4.

**FOLD-IN (orchestration override):** the aggregate `tasks/future/README.md`
(`:60`, `:78`, `:137-138`) and `tasks/future/pine-converter-coverage/README.md`
(`:131-132`) mandate that this folder ALSO ships a bar-close epoch accessor
(`time_close`). This folder's own README defers it — that deferral is
**overridden**. So we ADD `time.timeClose(t)` here (core hole + registry entry +
shim) and un-defer it in this folder's README.

## time_close shape decision

Pine's `time_close()` is **no-arg** and returns the close timestamp of the
**current** bar = `bar start + interval`. The runtime knows the interval via
`timeframe.inSeconds` (`packages/core/src/views/timeframe.ts`,
`TimeframeView.inSeconds`). To match Pine's no-arg form while staying a clean
function of an explicit `Time` (so it works on `bar.time` or any computed
epoch), the chosen shape is:

```ts
timeClose(t: Time, tz?: string): Time;   // = t + timeframe.inSeconds * 1000
```

- Takes the bar's **start** `Time` (like every sibling takes a `Time`), reads the
  current bar's `timeframe.inSeconds` internally (the runtime closes over it,
  exactly as the other accessors close over `syminfo.timezone` for `tz`). This
  matches Pine's implicit "current bar's interval" without an explicit
  interval-seconds arg (rejected as noisier and divergent from Pine).
- Carries the same optional `tz?` as the other `time.*` accessors for surface
  symmetry (the close instant is tz-independent in v1's UTC/fixed-offset math,
  but the parameter keeps the namespace uniform; runtime Task 2 decides usage).
- Registered `slot: false` (stateless) like the rest; the per-bar `inSeconds`
  it closes over is mount/step data, not per-callsite state.

Runtime impl lands in Task 2; converter mapping (`time_close()` → `time.timeClose`)
in Task 6.

## Pre-existing work

- Working tree is **clean** (state.array / bgcolor / multi-symbol-security are
  already committed — `git log`: `1efb49c`, `e620ba8`, `1101f23`, `0ed094c`,
  `2699bbd`). My diff is calendar-task-1-only.
- 4 pending changesets exist (`bgcolor-barcolor`, `state-array`,
  `multi-symbol-security`, `fix-lwc-seam-createchart`). I add one more.

## Issues found / corrections vs the task file

1. **`@since` version is stale in the task file.** Task says core is `1.1.1` →
   `@since 1.2`. **Actual** core `package.json` is `1.2.0`; recent features
   pre-allocate sequential minors in source `@since` even though changesets
   collapse them: `state.series`/`state.array` = `@since 1.3`, `bgcolor` =
   `@since 1.4`. Next free is **`@since 1.5`** — I use that, not `1.2`.
2. **Line numbers in the task file are stale** (it cites `types.ts:705-720` for
   `ComputeContext`; actual is `:773-818`. `:114` for `ta.nz` is correct.
   `index.ts:217-218` → actual `:211-212` / `:219`. `program.ts` cites
   `:1345-1348`/`:1047`/`:1348` → actual `ComputeContext` `:1376-1393`,
   `TimeframeView` `:1066-1074`, `state` decl `:1020-1034`). I use verified
   numbers below.
3. **Registry placement note is slightly off.** Task says "after `request.*`,
   before `defineAlertCondition.signal`". Verified: `request.lowerTf` (`:204`)
   then `defineAlertCondition.signal` (`:205`). I insert the 10 entries (9 +
   `time.timeClose`) between `:204` and `:205`.
4. **Entry count is 10, not 9** (task wrote 9; the time_close fold-in adds a
   10th). Counts in the two JSDoc blocks go `179 → 189`.
5. **Compile-test fixture must import the namespaces.** Ambient module exports
   are NOT globals; the bgcolor precedent imports the symbol. The task fixture
   uses bare `time`/`session`/`syminfo` — I import `session, time, syminfo` (and
   keep `bar`/`plot` from `compute`/`defineIndicator`) so it actually resolves.
6. **`docs:check` `@example` must be a self-contained `void` expression** —
   mirror the `state.ts` holes (`const fn: typeof time.year = time.year; void fn;`),
   not a call (a call throws and the namespace-level example must not).

## Steps (verified paths)

1. **Create** `packages/core/src/time-accessors/timeAccessors.ts`:
   - MIT header; `import type { Time } from "../types.js";`
   - local `sentinel(name)` (copy the `state/state.ts:8-10` pattern).
   - `export const time = Object.freeze({ year, month, dayofmonth, dayofweek,
     hour, minute, second, timestamp, timeClose })` — each method body
     `return sentinel("time.<name>")`. Signatures per the task type block +
     `timeClose(t: Time, tz?: string): Time`.
   - `export type TimeNamespace = typeof time;` (mirror `StateNamespace =
     typeof state`).
   - Full JSDoc on the namespace + each method: `@since 1.5`, `@stable`,
     `@example` (self-contained `void`). Document `tz` default =
     `syminfo.timezone` (fallback `"UTC"`) and Pine `dayofweek` `1=Sun..7=Sat`.
     `timeClose` JSDoc: "bar start + interval; the runtime reads the current
     bar's `timeframe.inSeconds`".
2. **Create** `packages/core/src/time-accessors/sessionAccessors.ts`:
   - MIT header; `import type { Time } from "../types.js";`; local `sentinel`.
   - `export const session = Object.freeze({ isOpen })`,
     `isOpen` body `return sentinel("session.isOpen")`.
   - `export type SessionNamespace = typeof session;`
   - JSDoc: `spec` grammar (`"HH:MM-HH:MM"` / `"HHMM-HHMM"`), `tz` default, v1
     UTC + fixed-offset only (DST → UTC + diagnostic; point at Task 6 docs).
3. **Create** `packages/core/src/time-accessors/index.ts` (barrel):
   `export { time } from "./timeAccessors.js"; export type { TimeNamespace } …;`
   `export { session } from "./sessionAccessors.js"; export type { SessionNamespace } …;`
4. **Create** `packages/core/src/time-accessors/timeAccessors.types.test.ts`:
   expect-type — build a `TimeNamespace` literal (functions returning
   `number`/`Time`), assert `time.year(0)` & `time.year(0,"UTC")` → `number`,
   `time.timestamp(2024,1,2)` → `Time` (number), `time.timeClose(0)` → `Time`.
   Mirror `state.types.test.ts` structure.
5. **Create** `packages/core/src/time-accessors/sessionAccessors.types.test.ts`
   (or fold into the same file per task table `*.types.test.ts`): assert
   `session.isOpen(0,"0930-1600")` & with tz → `boolean`.
6. **Create** `packages/core/src/time-accessors/timeAccessors.test.ts` +
   `sessionAccessors.test.ts`: assert each hole throws
   `"<name> called outside an active script step"` + namespace is frozen
   (mirror `state.test.ts`). Gives core 100% coverage on the two files.
7. **Modify** `packages/core/src/types.ts`:
   - `:6-15` import block — add
     `import type { SessionNamespace, TimeNamespace } from "./time-accessors/index.js";`
     (alphabetical: after `./ta/ta.js`, before `./views/index.js`).
   - `ComputeContext` (`:791` after `readonly timeframe`, before
     `readonly request`): add `readonly time: TimeNamespace;` +
     `readonly session: SessionNamespace;` each with a one-line
     `/** … @since 1.5 */` doc.
8. **Modify** `packages/core/src/index.ts` (near `:211-212`/`:219`):
   `export { session, time } from "./time-accessors/index.js";`
   `export type { SessionNamespace, TimeNamespace } from "./time-accessors/index.js";`
9. **Modify** `packages/core/src/statefulPrimitives.ts`: insert between `:204`
   (`request.lowerTf`) and `:205` (`defineAlertCondition.signal`), under a
   `// Calendar / session accessors — stateless (slot: false)` comment, the 10
   entries: `time.year/month/dayofmonth/dayofweek/hour/minute/second/timestamp/
   timeClose` + `session.isOpen`, all `slot: false`. Bump `179 → 189` in both
   JSDoc blocks (`:229`, `:257`).
10. **Modify** `packages/compiler/src/program.ts`:
    - After `TimeframeView` decl (`:1074`), before `RequestSecurityOpts`
      (`:1075`): add `export type TimeNamespace = Readonly<{ … }>;`
      (9 methods incl. `timeClose`) + `export const time: TimeNamespace;` and
      `export type SessionNamespace = Readonly<{ isOpen(t: Time, spec: string,
      tz?: string): boolean; }>;` + `export const session: SessionNamespace;`.
      `Readonly<{…}>` is fine here (no overloads — the interface rule only
      applies to overloaded namespaces like `RequestNamespace`).
    - `ComputeContext` (`:1389` after `readonly timeframe`): add
      `readonly time: TimeNamespace;` + `readonly session: SessionNamespace;`.
11. **Modify** `packages/compiler/src/compile.test.ts`: add a positive
    `compile()` test importing `session, time` (+ `syminfo` via import) that
    compiles the task §7 fixture body and asserts `Object.isFrozen(result)`
    (proves zero type diagnostics; mirror the bgcolor test at `:272`).
12. **Create** `.changeset/calendar-session-helpers.md` (task §9 body, the
    full feature changeset).
13. **Modify** `tasks/future/calendar-session-helpers/README.md` Deferred
    section: un-defer `time_close()` (note the aggregate-plan override).
14. **Update** `packages/core/CLAUDE.md` only if a non-obvious invariant
    emerges (the two new `slot: false` namespaces + the time_close
    "reads current-bar interval" note — add a short invariant bullet).

## Files table

| File | Action |
|------|--------|
| `packages/core/src/time-accessors/timeAccessors.ts` | Create |
| `packages/core/src/time-accessors/sessionAccessors.ts` | Create |
| `packages/core/src/time-accessors/index.ts` | Create |
| `packages/core/src/time-accessors/timeAccessors.types.test.ts` | Create |
| `packages/core/src/time-accessors/sessionAccessors.types.test.ts` | Create |
| `packages/core/src/time-accessors/timeAccessors.test.ts` | Create |
| `packages/core/src/time-accessors/sessionAccessors.test.ts` | Create |
| `packages/core/src/types.ts` | Modify |
| `packages/core/src/index.ts` | Modify |
| `packages/core/src/statefulPrimitives.ts` | Modify |
| `packages/compiler/src/program.ts` | Modify |
| `packages/compiler/src/compile.test.ts` | Modify |
| `packages/core/CLAUDE.md` | Modify (invariant bullet) |
| `tasks/future/calendar-session-helpers/README.md` | Modify (un-defer time_close) |
| `.changeset/calendar-session-helpers.md` | Create |

## Gates to keep green

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check`

## Changeset

`.changeset/calendar-session-helpers.md` — **minor** (core, compiler, runtime,
adapter-kit, pine-converter) + **patch** (cli).

## Acceptance criteria

- `TimeNamespace`/`SessionNamespace` defined + exported with full JSDoc; holes
  throw the active-step sentinel; `time.timeClose` present.
- `ComputeContext.time`/`.session` added; barrel re-exports both.
- 10 registry entries appended `slot: false`; counts bumped 179 → 189.
- `program.ts` shim mirrors core exactly.
- expect-type tests prove return types; `compile()` test proves usage
  type-checks with no diagnostics.
- Changeset committed; typecheck/lint/core+compiler tests/docs:check green.
- `time_close` un-deferred in the folder README.
