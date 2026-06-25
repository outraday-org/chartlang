# Task 2 — Comprehensive math.* / str.* author examples

> **Status: TODO**

## Goal

Add two author-style example scripts —
`examples/scripts/math-scalar-band.chart.ts` (exercises `math.nz`,
`clamp`, `avg`, `sum`, `sign`, `roundTo`) and
`examples/scripts/str-label-builder.chart.ts` (exercises `str.split`,
`contains`, `startsWith`, `replace`, `trim`, `substring`, `repeat`) —
wired into the CLI e2e compile gate, mirrored into the site demo, and
auto-generating their `docs/examples/*` pages. These cover the
math/str functions that no current example demonstrates.

## Prerequisites

None. Both namespaces exist in core.

## Current Behavior

- Only `tick-snapped-levels.chart.ts` (uses `math.roundToMintick`) and
  `str-formatted-hud.chart.ts` (uses `str.tostring` / `format` /
  `upper`) demonstrate the namespaces. 8/9 `math.*` and 11/14 `str.*`
  functions have no usage example.
- `packages/cli/src/e2e.test.ts` has an `EXAMPLE_SCRIPTS` array (~lines
  13–37) that drives `compile` over each path; both existing math/str
  examples are listed.
- `apps/site/src/components/demo/scripts.ts` holds a `const
  <NAME> = \`…\`` source string per script and a `DEMO_SCRIPTS` array of
  `{ id, label, description, source }` (the `DemoScript` shape — `label`
  and `description` are both required; there is no `title` field). `pnpm examples:sync`
  token-compares each `examples/scripts/<id>.chart.ts` against its
  same-`id` demo entry; `pnpm examples:generate` renders
  `docs/examples/index.md` + one page per demo entry.

## Desired Behavior

- Two new compile-clean examples exist, are in `EXAMPLE_SCRIPTS`,
  mirror byte-for-byte (token-wise) into `DEMO_SCRIPTS`, and have
  generated `docs/examples/math-scalar-band.md` /
  `str-label-builder.md` pages listed in `docs/examples/index.md`.

## Requirements

### 1. `examples/scripts/math-scalar-band.chart.ts`

Two-line MIT header + a header comment explaining it is the
comprehensive `math.*` companion to `tick-snapped-levels` (which only
shows `roundToMintick`). Default-export one `defineIndicator({
apiVersion: 1, … })`. Use **both** top-level imports and the
destructured `compute` params (the required convention — see
`examples/CLAUDE.md`). `math` is a **module-scope import**, never a
`compute` field.

Exercise `nz`, `clamp`, `avg`, `sum`, `sign`, `roundTo`. Starting
sketch (the implementer MUST validate it compiles via the e2e gate and
adjust as needed — `math.avg` / `math.sum` are **variadic scalar**
reducers, so pass scalar args, not a series):

```ts
import { defineIndicator, math, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Scalar Band",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        // math is a module-scope import (not a compute field).
        const typical = math.avg(bar.high, bar.low, bar.close);   // variadic mean
        const span = math.sum(bar.high - bar.low, 0);             // variadic sum (skip-NaN)
        const width = math.clamp(span, 0, typical);               // bounded band half-width
        const dir = math.sign(bar.close - bar.open);              // -1 / 0 / +1
        const mid = math.nz(math.roundTo(typical, 2), 0);         // guard + display rounding
        plot(mid + dir * width, { title: "Band edge" });
        plot(mid - dir * width, { title: "Band edge (mirror)" });
    },
});
```

`fixnan` / `na` / `roundToMintick` are already covered (the latter by
`tick-snapped-levels`); covering the six above is sufficient for "no
example" closure. If a clean compile needs `na`/`fixnan` too, add them.

### 2. `examples/scripts/str-label-builder.chart.ts`

Two-line MIT header + a header comment explaining it is the
comprehensive `str.*` companion to `str-formatted-hud` (which only
shows `tostring`/`format`/`upper`). Exercise `split`, `contains`,
`startsWith`, `replace`, `trim`, `substring`, `repeat`. A
`draw.table`-based HUD (like `str-formatted-hud`) is the natural shape.
Starting sketch (validate + adjust for compile):

```ts
import { defineIndicator, input, str } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "String Label Builder",
    apiVersion: 1,
    overlay: true,
    inputs: {
        // `input.string(defaultValue, opts?)` — the FIRST arg IS the default;
        // there is NO name parameter (the `tags` key names the input). Declare
        // inputs in this block and read them via `inputs.<key>` in `compute`,
        // exactly like `input.float` in `tick-snapped-levels.chart.ts`.
        tags: input.string("btc, eth ,#sol", { title: "Watchlist" }),
    },
    compute({ draw, inputs }) {
        // A comma-separated watchlist, sanitized + formatted with str.*.
        const raw = inputs.tags as string;
        const cells = str.split(raw, ",").map((token) => {
            const tag = str.trim(token);                          // trim
            const clean = str.replace(tag, "#", "");              // first-occurrence replace
            const upper3 = str.upper(str.substring(clean, 0, 3)); // substring + upper
            const flagged = str.startsWith(tag, "#") || str.contains(tag, "btc");
            return {
                text: `${upper3}${str.repeat(" ", 1)}${flagged ? "*" : ""}`,
                textColor: flagged ? "#22c55e" : "#e2e8f0",
            };
        });
        draw.table({ position: "top-right", cells: [cells] });
    },
});
```

Notes for the implementer:
- `input.string` must be top-level imported too if used. Its signature is
  `input.string(defaultValue: string, opts?: { title?; multiline? })` — the
  default is the first positional arg (no `name` param); the `inputs:`-block
  key names it and `compute` reads it via `inputs.<key>` (the
  `tick-snapped-levels` `input.float` idiom). Never call `input.*` inline in
  `compute`. Confirm the
  compiler accepts `.split(...).map(...)` building a table-cell row
  (`.map` is a plain JS array method, not a stateful primitive — only
  stateful `ta.*`/`draw.*`/`plot` calls are loop-restricted; a single
  `draw.table` call with a computed `cells` array is fine). If `.map`
  trips a forbidden-construct check, fall back to fixed indices.
- Keep `str` a module-scope import (frozen global, not a `compute`
  field).

### 3. Wire into the CLI e2e gate

Append both paths to `EXAMPLE_SCRIPTS` in
`packages/cli/src/e2e.test.ts`:

```ts
    "examples/scripts/math-scalar-band.chart.ts",
    "examples/scripts/str-label-builder.chart.ts",
```

These are compile-only (no per-file sidecar/integration assertion
needed, like most examples). Do NOT add them to
`examples/canvas2d-adapter/src/integration.test.ts` (no render test
required).

### 4. Mirror into the site demo

In `apps/site/src/components/demo/scripts.ts`, add a `const
MATH_SCALAR_BAND = \`…\`` and `const STR_LABEL_BUILDER = \`…\`` holding
the **exact** source of each on-disk file, then append two
`DEMO_SCRIPTS` entries with `id: "math-scalar-band"` /
`id: "str-label-builder"` (id MUST match the filename stem so
`examples:sync` pairs them), a `label` and `description` (both required
by `DemoScript`; there is no `title` field), and `source: MATH_SCALAR_BAND`
/ `STR_LABEL_BUILDER`. Match the field shape of the adjacent
`tick-snapped-levels` / `str-formatted-hud` entries.

`examples:sync` compares **token streams** (comments/whitespace/wrapping
ignored), so the demo string need not match formatting — only code
tokens. Keep the two copies in lockstep.

### 5. Generate the docs pages

Run `pnpm examples:generate` to render
`docs/examples/math-scalar-band.md`, `docs/examples/str-label-builder.md`,
and update `docs/examples/index.md`. Never hand-edit
`docs/examples/*.md` — re-run the generator. Verify `pnpm examples:gate`
is green.

### 6. Update folder docs

- `examples/scripts/CLAUDE.md`: add a "Shipped scripts" bullet for each
  new example (mirroring the detailed style of the existing
  `tick-snapped-levels` / `str-formatted-hud` bullets — note which
  functions each exercises, that `math`/`str` are module-scope imports,
  compile-only in the e2e gate, mirrored by a `DEMO_SCRIPTS` entry).
- `examples/CLAUDE.md`: extend the layout prose if the new samples
  warrant a mention (optional; match existing granularity).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/math-scalar-band.chart.ts` | Create | `math.*` comprehensive example |
| `examples/scripts/str-label-builder.chart.ts` | Create | `str.*` comprehensive example |
| `packages/cli/src/e2e.test.ts` | Modify | Append both to `EXAMPLE_SCRIPTS` |
| `apps/site/src/components/demo/scripts.ts` | Modify | Add two source consts + `DEMO_SCRIPTS` entries |
| `docs/examples/math-scalar-band.md` | Create (generated) | Auto-rendered example page |
| `docs/examples/str-label-builder.md` | Create (generated) | Auto-rendered example page |
| `docs/examples/index.md` | Modify (generated) | Lists the two new examples |
| `examples/scripts/CLAUDE.md` | Modify | Document the two new shipped scripts |

## Gates

- `pnpm --filter @invinite-org/chartlang-cli test` (or the e2e test) —
  both new scripts compile clean.
- `pnpm examples:sync` — each on-disk script token-matches its demo
  mirror.
- `pnpm examples:generate` then `pnpm examples:gate` — committed docs
  pages match the generator; `index.md` lists both.
- `pnpm typecheck`, `pnpm lint` — green (examples are Biome-formatted;
  run the formatter on the two new files).

## Changeset

**None.** `examples/` and `apps/site/` are not published npm packages,
and `docs/` is generated content — no `@invinite-org/chartlang-*`
version bump. Add a changeset only if a published package is touched
(it should not be).

## Acceptance Criteria

- Both example files exist, carry the two-line MIT header + a
  descriptive header comment, use top-level-import + destructured-param
  convention, keep `math`/`str` as module-scope imports, and compile
  clean in the CLI e2e gate.
- Together they exercise `math.{nz,clamp,avg,sum,sign,roundTo}` and
  `str.{split,contains,startsWith,replace,trim,substring,repeat}`.
- Both are in `EXAMPLE_SCRIPTS` and mirrored as same-`id`
  `DEMO_SCRIPTS` entries; `examples:sync` passes.
- `docs/examples/{math-scalar-band,str-label-builder}.md` are generated
  and listed in `index.md`; `examples:gate` passes.
- `examples/scripts/CLAUDE.md` documents both new scripts.
- `pnpm typecheck` / `pnpm lint` green.
