// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Bare re-export of the shared monotone-cubic spline, promoted to
// `@invinite-org/chartlang-adapter-kit`'s geometry layer so the canvas2d
// reference and the webgl example adapter sample ONE source (never a fork —
// the same promotion precedent as `render/coords.ts` shift helpers and
// `render/renderOrder.ts`). The behaviour is byte-identical to the former
// local copy, so the canvas2d goldens are untouched.
export { monotoneCubicSegments } from "@invinite-org/chartlang-adapter-kit";
export type { BezierSegment } from "@invinite-org/chartlang-adapter-kit";
