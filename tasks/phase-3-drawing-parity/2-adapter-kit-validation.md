# Task 2 — Adapter-kit: per-kind `validateEmission` + real `decodeDrawing` + capability builders

> **Status: TODO**

## Goal

Wire `@invinite-org/chartlang-adapter-kit` to the canonical Phase-3
types from Task 1: widen `DrawingKind` to the full 61-entry union,
narrow `DrawingEmission.state` from `unknown` to the `DrawingState`
discriminated union, replace the stub `decodeDrawing` with a typed
per-kind decoder, replace the unconditional-fail
`validateDrawingEmission` with a per-kind dispatch (anchor + style
+ meta validation), and extend the `capabilities.*` builder set
with one builder per kind, 13 category-group builders, the
`allPhase3Drawings()` umbrella, and the `bucketFor` re-export.

## Prerequisites

- Task 1 (core types: `DrawingKind`, `DrawingState`, `WorldPoint`,
  `DrawingHandle`, `KIND_BUCKET`, `bucketFor`).

## Current Behavior

- `packages/adapter-kit/src/types.ts:51` declares
  `DrawingKind = "line"` placeholder; `DrawingEmission.state:
  unknown`.
- `decodeDrawing(e)` returns `null` unconditionally.
- `validateDrawingEmission(e)` returns `{ ok: false, code:
  "unsupported-drawing-kind", message: "drawing emissions are not
  supported in Phase 1" }` unconditionally.
- `capabilities.*` has line/stepLine/horizontalLine/allLines +
  Phase-2 plot builders; no drawing builders.

## Desired Behavior

- `DrawingKind` re-exports
  `@invinite-org/chartlang-core/draw.DrawingKind`.
- `DrawingEmission.state: DrawingState` (typed).
- `decodeDrawing(e)`: returns `DrawingState` for well-formed
  payloads, `null` for malformed (with a `validateEmission` failure
  alongside).
- `validateDrawingEmission(e)`: per-kind dispatch over anchors +
  style + `name`/`visible` meta + JsonValue-clean walks. Returns
  `unsupported-drawing-kind` ONLY for unknown `drawingKind`;
  malformed payloads of a known kind return `malformed-emission`.
- `capabilities.<kind>()` ships for every kind (61 builders), plus
  13 category groups + `allPhase3Drawings()`. `bucketFor` re-exported.

## Requirements

### 1. `packages/adapter-kit/src/types.ts` updates

```ts
import type { DrawingKind as CoreDrawingKind, DrawingState } from "@invinite-org/chartlang-core";

/**
 * Drawing kind discriminator. Phase 3 widens the Phase-1 `"line"`
 * placeholder to the full §10 surface — re-exported from
 * `@invinite-org/chartlang-core`.
 *
 * @since 0.1
 * @experimental
 */
export type DrawingKind = CoreDrawingKind;

/**
 * A `draw.*` emission. `state` is the typed merged drawing state
 * — `op: "create"` carries the initial state, `op: "update"` the
 * full merged state per the Phase-3 full-state semantic, `op:
 * "remove"` the last-known state.
 *
 * @since 0.1
 * @experimental
 */
export type DrawingEmission = {
    readonly kind: "drawing";
    readonly handleId: string;
    readonly drawingKind: DrawingKind;
    readonly op: "create" | "update" | "remove";
    readonly state: DrawingState;
    readonly bar: number;
    readonly time: number;
};
```

Update `@since` notes on `DrawingKind` / `DrawingEmission` to mark
the Phase-3 widening.

### 2. `packages/adapter-kit/src/validation/validateEmission.ts`

Replace the stub validator with a per-kind dispatch. The new
function lives alongside `walkMeta` and reuses every existing
helper (`isPlainObject`, `isFiniteNumber`, `isNonEmptyString`,
`isNonNegativeInteger`, `bad`).

```ts
import { DRAWING_KINDS, KIND_KEBABCASE } from "@invinite-org/chartlang-core";

const VALID_DRAWING_KINDS: ReadonlySet<string> = new Set(DRAWING_KINDS);

function isWorldPoint(v: unknown): v is { time: number; price: number } {
    if (!isPlainObject(v)) return false;
    return isFiniteNumber(v.time) && isFiniteNumber(v.price);
}

function validateAnchorPair(v: unknown, path: string): ValidationResult {
    if (!Array.isArray(v) || v.length !== 2) {
        return bad(`${path}: must be a 2-element WorldPoint tuple`);
    }
    for (let i = 0; i < 2; i++) {
        if (!isWorldPoint(v[i])) return bad(`${path}[${i}]: not a WorldPoint`);
    }
    return { ok: true };
}
// … plus validateAnchorTriple, validateAnchorQuad, validateAnchorQuint,
// validateAnchorHept, validateAnchorVariable(min, max).

function validateLineDrawStyle(s: unknown, path: string): ValidationResult {
    if (!isPlainObject(s)) return bad(`${path}: not a plain object`);
    if (s.color !== undefined && typeof s.color !== "string") {
        return bad(`${path}.color: must be a string`);
    }
    if (s.lineWidth !== undefined && (!isFiniteNumber(s.lineWidth) || s.lineWidth <= 0)) {
        return bad(`${path}.lineWidth: must be a finite positive number`);
    }
    if (s.lineStyle !== undefined && !VALID_LINE_STYLES.has(String(s.lineStyle))) {
        return bad(`${path}.lineStyle: '${String(s.lineStyle)}' is not a valid line style`);
    }
    if (s.extendLeft !== undefined && typeof s.extendLeft !== "boolean") {
        return bad(`${path}.extendLeft: must be a boolean`);
    }
    if (s.extendRight !== undefined && typeof s.extendRight !== "boolean") {
        return bad(`${path}.extendRight: must be a boolean`);
    }
    return { ok: true };
}
// … plus validateShapeStyle, validateHighlighterStyle, validateBrushStyle,
//   validateTextOpts, validateArrowOpts, validateArrowMarkerOpts,
//   validatePathOpts, validateFibOpts, validateRegressionTrendOpts,
//   validateFrameOpts.

function validateDrawingMeta(state: Record<string, unknown>): ValidationResult {
    if (state.name !== undefined && typeof state.name !== "string") {
        return bad("drawing.state.name: must be a string");
    }
    if (state.visible !== undefined && typeof state.visible !== "boolean") {
        return bad("drawing.state.visible: must be a boolean");
    }
    return { ok: true };
}

function validateDrawingEmission(e: Record<string, unknown>): ValidationResult {
    if (!isNonEmptyString(e.handleId)) return bad("drawing.handleId: must be a non-empty string");
    const drawingKind = e.drawingKind;
    if (typeof drawingKind !== "string" || !VALID_DRAWING_KINDS.has(drawingKind)) {
        return {
            ok: false,
            code: "unsupported-drawing-kind",
            message: `drawing.drawingKind: '${String(drawingKind)}' is not a known DrawingKind`,
        };
    }
    if (e.op !== "create" && e.op !== "update" && e.op !== "remove") {
        return bad(`drawing.op: '${String(e.op)}' must be 'create' | 'update' | 'remove'`);
    }
    if (!isNonNegativeInteger(e.bar)) return bad("drawing.bar: must be a non-negative integer");
    if (!isFiniteNumber(e.time)) return bad("drawing.time: must be a finite number");
    const state = e.state;
    if (!isPlainObject(state)) return bad("drawing.state: must be a plain object");
    if (state.kind !== drawingKind) {
        return bad(`drawing.state.kind: '${String(state.kind)}' must equal drawing.drawingKind '${drawingKind}'`);
    }
    const metaCheck = validateDrawingMeta(state);
    if (!metaCheck.ok) return metaCheck;
    return validateStateByKind(drawingKind as DrawingKind, state);
}

function validateStateByKind(kind: DrawingKind, state: Record<string, unknown>): ValidationResult {
    switch (kind) {
        case "line": return validateLineState(state);
        case "horizontal-line": return validateHorizontalLineState(state);
        // … 59 more switch arms — one validator function per kind.
        // Each lives in this file; they're 3–10 lines each.
        /* v8 ignore next 2 -- VALID_DRAWING_KINDS pre-gates. */
        default:
            return bad(`drawing.state: no validator for kind '${kind}'`);
    }
}
```

**Per-kind validator functions** — Tasks 5–18 fill these in
detail. Task 2 lands the dispatch + the 8 line-kind validators
(Lines/Rays, the Task-5 surface) so the validator file compiles
green. Tasks 6–18 each ADD their kind validators to this file
(same file — no per-kind file split) as part of their port PR.
Each kind's validator pins: anchor shape (count + WorldPoint
shape), style payload (lineWidth, color, lineStyle, fillAlpha,
…), and any kind-specific fields (e.g. `pitchfork.variant ∈
{...}`, `marker.markerKind ∈ {"emoji", "icon"}`).

Reuse `walkMeta` for any kind that carries a free-form `meta`
field (currently `text.body`, `marker.value`, `frame.label` —
none use `meta` per se, but the same Json-cleanliness rule
applies).

### 3. `packages/adapter-kit/src/validation/decodeDrawing.ts`

Replace the stub with the real decoder:

```ts
import type { DrawingState } from "@invinite-org/chartlang-core";
import type { DrawingEmission } from "../types";
import { validateEmission } from "./validateEmission";

/**
 * Narrow a {@link DrawingEmission} to its typed {@link DrawingState}.
 * Returns `null` if the emission fails the same validation
 * {@link validateEmission} runs — adapters that want to know WHY
 * call `validateEmission(e)` directly.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { decodeDrawing } from "@invinite-org/chartlang-adapter-kit";
 *     declare const e: import("@invinite-org/chartlang-adapter-kit").DrawingEmission;
 *     const state = decodeDrawing(e);
 *     if (state !== null && state.kind === "line") {
 *         // state is LineState
 *         console.log(state.from, state.to);
 *     }
 */
export function decodeDrawing(e: DrawingEmission): DrawingState | null {
    const v = validateEmission(e as unknown);
    if (!v.ok) return null;
    // `validateEmission` already pinned `state.kind === drawingKind`
    // and validated the state shape — narrow via a switch.
    return e.state;
}
```

### 4. `packages/adapter-kit/src/capabilities/capabilities.ts` extension

Add 61 per-kind builders + 13 category groups + the umbrella:

```ts
import type { DrawingKind } from "../types";
import { DRAWING_KINDS, KIND_CAMELCASE } from "@invinite-org/chartlang-core";

// Add to the `capabilities` object:

/** Phase-3 — `line` drawing kind. @since 0.3 @experimental */
line(): ReadonlySet<DrawingKind> { return new Set<DrawingKind>(["line"]); },
horizontalLine(): ReadonlySet<DrawingKind> { return new Set<DrawingKind>(["horizontal-line"]); },
horizontalRay(): ReadonlySet<DrawingKind> { return new Set<DrawingKind>(["horizontal-ray"]); },
// … 58 more per-kind builders.

// Category groups:
allLineDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>([
        "line", "horizontal-line", "horizontal-ray",
        "vertical-line", "cross-line", "trend-angle",
    ]);
},
allBoxDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>([
        "rectangle", "rotated-rectangle", "triangle", "polyline",
        "circle", "ellipse", "path", "marker",
    ]);
},
allCurveDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>(["arc", "curve", "double-curve"]);
},
allFreehandDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>(["pen", "highlighter", "brush"]);
},
allAnnotationDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>([
        "text", "arrow", "arrow-marker", "arrow-mark-up", "arrow-mark-down",
    ]);
},
allChannelDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>([
        "trend-channel", "flat-top-bottom", "disjoint-channel", "regression-trend",
    ]);
},
allFibDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>([
        "fib-retracement", "fib-trend-extension", "fib-channel", "fib-time-zone",
        "fib-wedge", "fib-speed-fan", "fib-speed-arcs", "fib-spiral",
        "fib-circles", "fib-trend-time",
    ]);
},
allGannDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>([
        "gann-box", "gann-square-fixed", "gann-square", "gann-fan",
    ]);
},
allPitchforkDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>(["pitchfork", "pitchfan"]);
},
allPatternDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>([
        "xabcd-pattern", "cypher-pattern", "head-and-shoulders",
        "abcd-pattern", "triangle-pattern", "three-drives-pattern",
    ]);
},
allElliottDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>([
        "elliott-impulse-wave", "elliott-correction-wave",
        "elliott-triangle-wave", "elliott-double-combo", "elliott-triple-combo",
    ]);
},
allCycleDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>(["cyclic-lines", "time-cycles", "sine-line"]);
},
allContainerDrawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>(["group", "frame"]);
},
/** Every kind ships in Phase 3. @since 0.3 @experimental */
allPhase3Drawings(): ReadonlySet<DrawingKind> {
    return new Set<DrawingKind>(DRAWING_KINDS);
},
```

Each builder lands with a unit test asserting cardinality + kind
membership. The 13 category groups + the umbrella have property
tests asserting `union(allLine, allBox, … allContainer).size ===
allPhase3Drawings().size === 61`.

### 5. `packages/adapter-kit/src/index.ts`

Re-export `bucketFor` and `KIND_BUCKET` from core for adapter
authors that want to pre-budget against the canonical bucket
table:

```ts
export { bucketFor, KIND_BUCKET, type DrawingBucket } from "@invinite-org/chartlang-core";
```

### 6. Tests (§16.3: unit + type)

- `validateEmission.test.ts` — for every kind, one happy-path test
  (`{ ok: true }`) and ≥3 failure tests (anchor count off, anchor
  not finite, style.field bad). The line-kind validator suites
  ship in Task 2 (8 kinds × 4 tests = 32 unit tests); subsequent
  port tasks each extend with their kind's tests.
- `decodeDrawing.test.ts` — happy path returns typed
  `DrawingState`; malformed returns `null`; `e.state.kind !==
  drawingKind` returns `null`.
- `capabilities.test.ts` — per-kind builder cardinality + member
  identity (61 tests); category-group cardinality (13 tests);
  umbrella size === 61; `union(…all 13) === allPhase3Drawings()`
  property test.
- `types.types.test.ts` — `DrawingEmission.state: DrawingState`
  (no longer `unknown`); `DrawingKind` matches core's
  `DrawingKind`.
- `bucketFor.test.ts` (re-export) — `bucketFor(k)` for every `k ∈
  DRAWING_KINDS` returns the bucket from `KIND_BUCKET`.

Coverage stays 100% on `packages/adapter-kit`. The per-kind
validator functions land with their unit tests in Task 2 for the
6 line kinds (the Task-5 surface); subsequent port tasks each
land their kind's validators + tests in the same PR. The
foundational dispatch + the 13 category-group builders MUST cover
to 100% in Task 2's PR.

### 7. JSDoc per §17.2

- `decodeDrawing` — `@since 0.3` (no longer 0.1 — the real impl
  ships now), `@example` exercises the typed narrow.
- Each new `capabilities.*` builder — `@since 0.3`,
  `@experimental`, `@example`.
- `validateEmission` — extend the existing JSDoc to note the
  Phase-3 widening.

### 8. README extension

`packages/adapter-kit/README.md` gains a "Drawing capabilities
(Phase 3)" entry pointing at the new builders + `bucketFor`. Cap
100 lines.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | Widen `DrawingKind`, narrow `DrawingEmission.state`. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | Per-kind dispatch + per-kind validator helpers (line-kind set lands now). |
| `packages/adapter-kit/src/validation/decodeDrawing.ts` | Modify | Real typed decoder. |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | Modify | +61 per-kind + 13 category + umbrella builders. |
| `packages/adapter-kit/src/index.ts` | Modify | Re-export `bucketFor` / `KIND_BUCKET` / `DrawingBucket`. |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify | Add line-kind suites + invalid-kind path tests. |
| `packages/adapter-kit/src/validation/decodeDrawing.test.ts` | Modify | Real-impl tests. |
| `packages/adapter-kit/src/capabilities/capabilities.test.ts` | Modify | Per-kind + category + umbrella tests. |
| `packages/adapter-kit/src/types.types.test.ts` | Modify | Update `DrawingEmission.state` shape. |
| `packages/adapter-kit/README.md` | Modify | "Drawing capabilities (Phase 3)" entry. |
| `.changeset/phase-3-task-2-adapter-kit.md` | Create | `@invinite-org/chartlang-adapter-kit: minor`. |

## Gates

- `pnpm -F @invinite-org/chartlang-adapter-kit typecheck`
- `pnpm -F @invinite-org/chartlang-adapter-kit test` (100%
  coverage on every line Task 2 added).
- `pnpm typecheck` workspace-wide (downstream packages must keep
  compiling against the widened `DrawingKind`).
- `pnpm lint`
- `pnpm docs:check`
- `pnpm readme:check`

`pnpm conformance` is unchanged at this task — the runtime still
doesn't emit drawings.

## Changeset

`@invinite-org/chartlang-adapter-kit: minor`. Description: "Widen
`DrawingKind` to the full Phase-3 surface; real `decodeDrawing`
implementation; per-kind `validateEmission` dispatch (line kinds
land now, remaining kinds land per port task); 61 per-kind +
13 category-group + 1 umbrella `capabilities.*` builders;
re-export `bucketFor` from core."

## Acceptance Criteria

- `DrawingKind` is the 61-entry union from core, NOT the `"line"`
  placeholder.
- `validateEmission` happy path + failure paths covered for the 6
  line kinds.
- `decodeDrawing` returns typed `DrawingState` for valid
  emissions; `null` otherwise.
- `capabilities.allPhase3Drawings().size === 61`; every category
  group has the cardinality declared in §10.2 (lines 6, boxes 8,
  curves 3, freehand 3, annotations 5, channels 4, fib 10, gann 4,
  pitchforks 2, patterns 6, elliott 5, cycles 3, containers 2).
- 100% coverage on `packages/adapter-kit`.
- `pnpm typecheck` workspace-wide green (Phase-2 callers of the
  old `DrawingKind = "line"` placeholder must compile — there is
  one canvas2d declaration to update; verify it during this PR).
- Phase-2 gates remain green.
- Changeset committed.
