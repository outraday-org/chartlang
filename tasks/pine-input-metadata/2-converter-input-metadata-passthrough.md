# Task 2 — Converter: map group / inline / tooltip / display / confirm through

> **Status: TODO**

## Goal

Make the Pine converter emit `group`/`inline`/`tooltip`/`display`/`confirm`
onto the chartlang `input.*` opts object instead of dropping them with
`input-arg-not-mapped`, so converted scripts preserve their panel layout.
`input-arg-not-mapped` survives only for genuinely unmodellable args
(`active`, unknowns) and non-literal values.

## Prerequisites

Task 1 (core builders must accept the five fields, or the converter's
`fixtures-compile.test.ts` round-trip fails to type-check).

## Current Behavior

`packages/pine-converter/src/transform/inputs.ts`:

- `buildOptions(named, multiline, diagnostics, skipOptionsArg)` maps `title`,
  `minval→min`, `maxval→max`, `step`, forces `multiline` for `text_area`,
  and for **every other** named arg calls `warnUnmappedInputArg` →
  `input-arg-not-mapped` (consolidated once per arg name via `pushCodeOnce`).
- `enumTitleOpt` / `resolveOptionsEnum` thread only `title`; other named args
  on a dropdown warn `input-arg-not-mapped`.

So MASM's `input.int(1, "D", group=menue_group_1, inline="1", tooltip="…")`
converts to `input.int(1, { title: "D" })`, losing group/inline/tooltip.

## Desired Behavior

The same call converts to:

```ts
input.int(1, { title: "D", group: "Timeframe", inline: "1",
    tooltip: "Start date for strategy timeframe (year, month, day)" })
```

`group`/`inline`/`tooltip` are literal strings; `display` maps the Pine
`display.*` enum; `confirm` maps a boolean literal. Non-literal values still
drop with `input-arg-not-mapped`. `active` still drops (out of scope).

## Requirements

### 1. Resolve `group`/`inline`/`tooltip` as string options (`inputs.ts`)

In `buildOptions`, before the generic unmapped-arg loop, add the three
string passthrough args alongside `title`. Refactor the existing `title`
handling into a small table-driven loop so the four string args share one
path:

```ts
const STRING_PASSTHROUGH_ARGS: ReadonlyMap<string, string> = new Map([
    ["title", "title"],
    ["group", "group"],
    ["inline", "inline"],
    ["tooltip", "tooltip"],
]);
```

For each present arg: `stringLiteralOf(arg.value)` → push `key: <literal>`;
a non-literal value → `warnNonLiteralInputArg(diagnostics, name, span)`
(reuses the existing `input-arg-not-mapped` non-literal message). The
generic unmapped-arg loop must now **exclude** these keys (extend the
`argName !== "title" && !RANGE_ARG_TO_OPTION.has(argName)` guard to also skip
`group`/`inline`/`tooltip`/`display`/`confirm`).

### 2. Map `display` via a converter table (`inputs.ts` + `mapping/enums.ts`)

Pine `display.all|status_line|data_window|none` → chartlang
`"all"|"status-line"|"data-window"|"none"`. Add an `INPUT_DISPLAY_MAP`
`ReadonlyMap<string, string>` to `mapping/enums.ts` (distinct from the
plot-path `DISPLAY_MAP`, which maps `display.status_line`/`display.data_window`
to `null` — "no chartlang analogue beyond all/none; left visible" — because
the *plot* model has no status-line/data-window distinction; the *input*
model does, so the input map keeps them). The arg
value is a member-access expression `display.<member>`; read the member name
(reuse `dottedCallee`/member-chain access from `callArgs.ts` or a small local
reader). Mapping rules:

- `display.all` → **omit** the key (default; byte-clean).
- `display.none` → `display: "none"`.
- `display.status_line` → `display: "status-line"`.
- `display.data_window` → `display: "data-window"`.
- Any other / non-`display.*` value → `warnUnmappedInputArg(…, "display", …)`
  (drop, leave default).

### 3. Map `confirm` as a boolean literal (`inputs.ts`)

`confirm=true`/`false` → `confirm: true|false` (push only when the literal is
`true`? — no: push the literal value as written; a `confirm: false` is
harmless and matches Pine). A non-boolean-literal value drops with
`warnNonLiteralInputArg(…, "confirm", …)`. Read via the existing
`literalDefault` (a `bool` literal returns `"true"`/`"false"`).

### 4. Thread the same fields through the enum bridge (`resolveOptionsEnum` / `enumTitleOpt`)

The `options=[…]` → `input.enum(default, [...], { … })` bridge currently only
emits `{ title }`. Extend `enumTitleOpt` (rename conceptually to build the
full opts fragment) to also include `group`/`inline`/`tooltip`/`display`/
`confirm` resolved by the same helpers as `buildOptions`, so a dropdown like
MASM's `compmode_select` keeps its group/inline. In `resolveOptionsEnum`, the
"any other named arg has no enum analogue" loop (currently warns on every arg
≠ `title`/`options`) must skip the five passthrough keys too.

### 5. Diagnostics

- `input-arg-not-mapped` (warning) stays the code, now fired only for: a
  non-literal `title`/`group`/`inline`/`tooltip`/`confirm`/`display` value,
  `active`, and any future unknown named arg. Keep the per-arg-name
  `pushCodeOnce` consolidation.
- No new diagnostic codes.
- Update the `packages/pine-converter/CLAUDE.md` "Transform: inputs"
  invariant + the "Residual diagnostics" `input-arg-not-mapped` note: the
  dropped set narrows to `active`/`confirm`-non-literal/etc.; group/inline/
  tooltip/display/confirm are now mapped.

### 6. Fixtures (goldens)

Regenerate / update the affected expected outputs:

- `71-input-args-consolidated.*` — was the canonical "group/inline/tooltip
  dropped" fixture. Its expected `.chart.ts` now carries the three fields;
  its expected `.diagnostics.json` loses the three `input-arg-not-mapped`
  warnings (keep any that remain for genuinely-unmapped args — adjust the
  fixture's Pine to retain at least one non-literal/`active` arg so the code
  still has a witness, OR add a new small fixture for that).
- `49-input-string-enum.*` and `50-numeric-options-and-bare-input.*` — if
  they carry group/inline/tooltip, update expected outputs.
- Add a focused fixture `76-input-metadata-full.pine` exercising all five
  fields on `int`/`bool`/`string` + a `display.data_window` + a `confirm`,
  with expected `.chart.ts` + `.diagnostics.json`. `golden.test.ts`
  auto-discovers `*.pine` via `readdirSync`, so the only edit is bumping the
  hard-coded corpus-size assertion `expect(pineFixtures.length).toBe(76)`
  (currently 76 fixtures, `golden.test.ts:55`) to `.toBe(77)`. (`76` is the
  next free numeric prefix — highest existing is `75`.)
- Confirm `fixtures-compile.test.ts` round-trips the new/updated fixtures
  (they must compile through `@invinite-org/chartlang-compiler` — depends on
  Task 1).

### 7. Docs

Update `docs/converter/supported.md` (inputs section: list the now-mapped
args) and `docs/converter/rejects.md` / `diagnostics.md` (narrow the
`input-arg-not-mapped` description). Update
`skills/chartlang-coding/references/translating-from-pine.md` input row.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/inputs.ts` | Modify | Map the 5 fields; narrow the unmapped loop |
| `packages/pine-converter/src/mapping/enums.ts` | Modify | `INPUT_DISPLAY_MAP` |
| `packages/pine-converter/src/transform/inputs.test.ts` | Modify | Unit coverage for each field + non-literal drop |
| `packages/pine-converter/fixtures/71-*` | Modify | Updated expected outputs |
| `packages/pine-converter/fixtures/49-*`, `50-*` | Modify (if affected) | Updated expected outputs |
| `packages/pine-converter/fixtures/76-input-metadata-full.*` | Create | New witness fixture |
| `packages/pine-converter/src/tests/golden.test.ts` | Modify | Bump corpus-size assertion `toBe(76)` → `toBe(77)` (fixtures auto-discovered) |
| `packages/pine-converter/CLAUDE.md` | Modify | Update inputs + residual-diagnostics invariants |
| `docs/converter/supported.md`, `rejects.md`, `diagnostics.md` | Modify | Doc the mapping |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Input row |
| `.changeset/converter-input-metadata-passthrough.md` | Create | Changeset |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on pine-converter; `inputs.ts` is fully covered)
- `pnpm skills:gate`
- Converter golden + `fixtures-compile` suites green

## Changeset

`.changeset/converter-input-metadata-passthrough.md` — **minor** bump for
`@invinite-org/chartlang-pine-converter`.

## Acceptance Criteria

- MASM's `input.int(1, "D", group=…, inline="1", tooltip="…")` converts with
  `group`/`inline`/`tooltip` preserved; `display`/`confirm` map per the table.
- `input-arg-not-mapped` fires only for non-literal values + `active` +
  unknowns; per-arg-name consolidation intact.
- Fixtures 71 / 76 (+ 49/50 if affected) updated and compile through the
  compiler round-trip.
- `CLAUDE.md` invariants + converter docs + skill reference updated.
- 100% coverage on `inputs.ts`/`enums.ts`; changeset committed.
