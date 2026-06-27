// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-21b example fragment — one single-concept example per language
 * *idiom* (the "how you express X" surface under `docs/language/**` and the
 * example-bearing parts of `docs/spec/**`), all in the `language` category.
 *
 * These entries credit **no** primitive (`primitives: []`) and instead set
 * `idioms` — the idiom-gate signal `pnpm examples:idioms` cross-checks
 * against `examples/idiom-manifest.json`. Idioms are orthogonal to the
 * per-primitive `examples:coverage` gate (now fully enforcing, no allowlist),
 * so they never count toward primitive coverage.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const LANGUAGE_IDIOMS_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "idiom-series-index",
        label: "Idiom · Series Indexing",
        description:
            "Reading a `Series<T>` by index: plot an EMA's bar-over-bar delta (`ema.current − ema[1]`) using `.current` / `[n]` / `.length`.",
        category: "language",
        primitives: [],
        idioms: ["lang.seriesIndex"],
    },
    {
        id: "idiom-bar-series-index",
        label: "Idiom · Bar Series Indexing",
        description:
            "Indexing the price series directly (`bar.close[1]`) plus the raw-number coercion caveat — `+bar.close` for the scalar a comparison or `state.*` slot needs.",
        category: "language",
        primitives: [],
        idioms: ["lang.barSeriesIndex"],
    },
    {
        id: "idiom-plot-offset",
        label: "Idiom · Plot Offset",
        description:
            "The bidirectional `ta.*` `offset` display shift: an SMA drawn unshifted plus `+5` (right/future) and `−5` (left/past) copies, while the numeric value stays unshifted.",
        category: "language",
        primitives: [],
        idioms: ["lang.offset"],
    },
    {
        id: "idiom-warmup-gap",
        label: "Idiom · Warmup Gap",
        description:
            "Warmup `NaN` renders as a plot gap, not a zero: `ta.ema(_, 50)` is `NaN` for its first 49 bars and the line simply starts late.",
        category: "language",
        primitives: [],
        idioms: ["lang.warmupGap"],
    },
    {
        id: "idiom-bounded-loop",
        label: "Idiom · Bounded Loop Window",
        description:
            "A rolling mean expressed as a bounded `for (i < N) bar.close[i]` loop — the loop form of an unrolled `series[0] + … + series[N]`, sized identically by the compiler.",
        category: "language",
        primitives: [],
        idioms: ["lang.boundedLoop"],
    },
    {
        id: "idiom-bar-point",
        label: "Idiom · Bar Point Anchors",
        description:
            "`bar.point(offset, price)` drawing anchors spanning past and future: one line from `bar.point(-20, …)` to `bar.point(+20, …)`.",
        category: "language",
        primitives: [],
        idioms: ["lang.barPoint"],
    },
    {
        id: "idiom-dep-output",
        label: "Idiom · Dependency Output",
        description:
            'Consume another indicator\'s titled plot as a `Series<number>` via `<dep>.output("title")` — a private `const` producer read by the default export.',
        category: "language",
        primitives: [],
        idioms: ["lang.depOutput"],
    },
    {
        id: "idiom-with-inputs",
        label: "Idiom · withInputs Override",
        description:
            "Override a dependency's input defaults without forking via `<dep>.withInputs({ length })`, then read its output.",
        category: "language",
        primitives: [],
        idioms: ["lang.withInputs"],
    },
    {
        id: "idiom-multi-export",
        label: "Idiom · Multi-Export File",
        description:
            "One file declaring three indicators: a private `const` dep (data feed), an `export const` sibling (rendered), and the `export default` primary.",
        category: "language",
        primitives: [],
        idioms: ["lang.multiExport"],
    },
    {
        id: "idiom-cross-file-import",
        label: "Idiom · Cross-File Import",
        description:
            'A same-package cross-file dependency: `import baseTrend from "./base-trend.chart"` inlines the producer\'s compiled module and reads its output.',
        category: "language",
        primitives: [],
        idioms: ["lang.crossFileImport"],
    },
    {
        id: "idiom-pane-routing",
        label: "Idiom · Pane Routing",
        description:
            'Route a bounded oscillator into its own subpane with `plot(_, { pane: "rsi" })` (folds to overlay with an `unsupported-pane` diagnostic where panes are unsupported).',
        category: "language",
        primitives: [],
        idioms: ["lang.paneRouting"],
    },
    {
        id: "idiom-version-pinning",
        label: "Idiom · Version Pinning",
        description:
            "`apiVersion: 1` as a numeric literal pin — the frozen language contract every chartlang v1 implementation honours forever.",
        category: "language",
        primitives: [],
        idioms: ["lang.versionPinning"],
    },
    {
        id: "idiom-define-drawing",
        label: "Idiom · defineDrawing",
        description:
            "The `defineDrawing` script kind (drawing-first): a drawing-only script that emits `draw.*` with no plot output.",
        category: "language",
        primitives: [],
        idioms: ["lang.defineDrawing"],
    },
    {
        id: "idiom-define-alert",
        label: "Idiom · defineAlert",
        description:
            "The `defineAlert` script kind: a headless alert-only script that fires `alert(...)` and emits nothing to render.",
        category: "language",
        primitives: [],
        idioms: ["lang.defineAlert"],
    },
    {
        id: "idiom-define-alert-condition",
        label: "Idiom · defineAlertCondition",
        description:
            'The `defineAlertCondition` script kind: user-wireable named conditions signalled via `signal?.("id", cond)`.',
        category: "language",
        primitives: [],
        idioms: ["lang.defineAlertCondition"],
    },
];

export default LANGUAGE_IDIOMS_FRAGMENT;
