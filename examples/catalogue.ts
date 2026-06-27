// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Author-facing example registry — the single source of truth for the
 * demo's categorized browser dialog, the docs Examples section, the CLI
 * e2e compile set, and the coverage gate.
 *
 * Pure type + data module: **no React, no Node imports**, so the
 * `apps/site` client bundle, the `scripts/` generators, and
 * `packages/cli` can all import it. `apps/site/src/components/demo/
 * scripts.ts` and `examples/catalogue.json` are **generated** from this
 * registry (+ each `examples/scripts/<id>.chart.ts` source) by
 * `pnpm examples:generate`; `pnpm examples:coverage` cross-checks every
 * entry's `primitives` against the `docs/primitives/**` page tree.
 *
 * @since 0.1.0
 */

import complexFragment from "./catalogue/complex";
import taMovingAveragesFragment from "./catalogue/ta-moving-averages";
import taMomentumIFragment from "./catalogue/ta-momentum-i";
import taMomentumIiFragment from "./catalogue/ta-momentum-ii";
import taTrendFragment from "./catalogue/ta-trend";
import taBandsVolatilityFragment from "./catalogue/ta-bands-volatility";
import taVolumeFragment from "./catalogue/ta-volume";
import taVolumeProfileFragment from "./catalogue/ta-volume-profile";
import taPivotsUtilityFragment from "./catalogue/ta-pivots-utility";
import drawLinesFragment from "./catalogue/draw-lines";
import drawShapesFragment from "./catalogue/draw-shapes";
import drawMarkersFragment from "./catalogue/draw-markers";
import drawChannelsFragment from "./catalogue/draw-channels";
import drawFibonacciFragment from "./catalogue/draw-fibonacci";
import drawGannFragment from "./catalogue/draw-gann";
import drawElliottFragment from "./catalogue/draw-elliott";
import drawPatternsFragment from "./catalogue/draw-patterns";
import inputsFragment from "./catalogue/inputs";
import statePlotAlertFragment from "./catalogue/state-plot-alert";
import defineBarContextFragment from "./catalogue/define-bar-context";
import languageIdiomsFragment from "./catalogue/language-idioms";

/**
 * Fixed taxonomy for the demo's categorized browser dialog AND the
 * invinite template dialog (the canonical category set both products
 * share — see Tasks 23-25). `complex` holds only the curated
 * *multi-primitive* showcase demos (composition / MTF / pane-routing /
 * idiom). Single-primitive demos are folded in as their primitive's
 * family-category default, never `complex` (see Task 1 §6a fold rule).
 *
 * @since 0.1.0
 * @stable
 */
export type ExampleCategory =
    | "complex"
    | "ta-moving-averages"
    | "ta-momentum"
    | "ta-trend"
    | "ta-bands-volatility"
    | "ta-volume"
    | "ta-volume-profile"
    | "ta-pivots-utility"
    | "draw-lines"
    | "draw-shapes"
    | "draw-markers"
    | "draw-channels"
    | "draw-fibonacci"
    | "draw-gann"
    | "draw-elliott"
    | "draw-patterns"
    | "math"
    | "str"
    | "inputs"
    | "state-plot-alert"
    | "define-bar-context"
    | "language";

/**
 * Human-readable category labels for the dialog sidebar + docs grouping.
 *
 * @since 0.1.0
 * @stable
 */
export const CATEGORY_LABELS: Readonly<Record<ExampleCategory, string>> = {
    complex: "Complex",
    "ta-moving-averages": "TA · Moving Averages",
    "ta-momentum": "TA · Momentum",
    "ta-trend": "TA · Trend & Directional",
    "ta-bands-volatility": "TA · Bands & Volatility",
    "ta-volume": "TA · Volume & Flow",
    "ta-volume-profile": "TA · Volume Profiles",
    "ta-pivots-utility": "TA · Pivots & Utilities",
    "draw-lines": "Draw · Lines & Rays",
    "draw-shapes": "Draw · Shapes",
    "draw-markers": "Draw · Markers & Text",
    "draw-channels": "Draw · Channels & Regression",
    "draw-fibonacci": "Draw · Fibonacci",
    "draw-gann": "Draw · Gann",
    "draw-elliott": "Draw · Elliott Waves",
    "draw-patterns": "Draw · Patterns",
    math: "Math",
    str: "Strings",
    inputs: "Inputs",
    "state-plot-alert": "State, Plot & Alert",
    "define-bar-context": "Define, Bar & Context",
    language: "Core · Language Idioms",
} as const;

/**
 * Display order of categories in the dialog + docs sidebar — the same
 * order as the {@link ExampleCategory} union.
 *
 * @since 0.1.0
 * @stable
 */
export const CATEGORY_ORDER: ReadonlyArray<ExampleCategory> = [
    "complex",
    "ta-moving-averages",
    "ta-momentum",
    "ta-trend",
    "ta-bands-volatility",
    "ta-volume",
    "ta-volume-profile",
    "ta-pivots-utility",
    "draw-lines",
    "draw-shapes",
    "draw-markers",
    "draw-channels",
    "draw-fibonacci",
    "draw-gann",
    "draw-elliott",
    "draw-patterns",
    "math",
    "str",
    "inputs",
    "state-plot-alert",
    "define-bar-context",
    "language",
];

/**
 * Metadata for one example. `id` matches the
 * `examples/scripts/<id>.chart.ts` basename; `source` is inlined from
 * that file by the generators, never stored here.
 *
 * `primitives` lists the canonical primitive ids the example is the
 * *default* demo for (the coverage gate's "covered" signal). A `default`
 * (single-primitive) entry credits **exactly one**; a `complex`
 * composite credits only a primitive that has no cleaner single-primitive
 * default, and **may credit none** (the `(omit)` rows of Task 1 §6b — the
 * default owns the coverage, so the composite must not preempt it).
 *
 * @since 0.1.0
 * @stable
 */
export type ExampleMeta = Readonly<{
    /** Matches `examples/scripts/<id>.chart.ts` basename. */
    id: string;
    label: string;
    description: string;
    category: ExampleCategory;
    /**
     * Canonical primitive ids this example is the default demo for.
     * Non-empty for `default` entries; possibly empty for `complex`
     * composites (Task 1 §6b fold rule) and `language` idiom examples
     * (which credit `idioms`, not `primitives`).
     */
    primitives: ReadonlyArray<string>;
    /**
     * Canonical `lang.*` idiom ids this example is the default demo for —
     * the idiom-gate analog of {@link ExampleMeta.primitives}. Set **only**
     * on `language`-category entries (cross-checked against
     * `examples/idiom-manifest.json` by `pnpm examples:idioms`); omitted on
     * every primitive example.
     *
     * @since 0.1.0
     */
    idioms?: ReadonlyArray<string>;
}>;

/**
 * The assembled registry. Concatenated from per-task fragment modules
 * under `examples/catalogue/` so the ~19 population tasks (3–21) each own
 * a disjoint file and can run in parallel without colliding on this
 * barrel. Each fragment default-exports a `ReadonlyArray<ExampleMeta>`;
 * this barrel spreads them in `CATEGORY_ORDER`. Task 1 owns only the
 * migrated `complex.ts` fragment (its filename is historical — each
 * entry's `category` field, not the file, drives grouping).
 *
 * @since 0.1.0
 * @stable
 */
export const EXAMPLE_CATALOGUE: ReadonlyArray<ExampleMeta> = [
    ...complexFragment,
    ...taMovingAveragesFragment,
    ...taMomentumIFragment,
    ...taMomentumIiFragment,
    ...taTrendFragment,
    ...taBandsVolatilityFragment,
    ...taVolumeFragment,
    ...taVolumeProfileFragment,
    ...taPivotsUtilityFragment,
    ...drawLinesFragment,
    ...drawShapesFragment,
    ...drawMarkersFragment,
    ...drawChannelsFragment,
    ...drawFibonacciFragment,
    ...drawGannFragment,
    ...drawElliottFragment,
    ...drawPatternsFragment,
    ...inputsFragment,
    ...statePlotAlertFragment,
    ...defineBarContextFragment,
    ...languageIdiomsFragment,
];
