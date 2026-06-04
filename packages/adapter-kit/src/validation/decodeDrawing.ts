// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "../types";

/**
 * Phase-1 stub for the §7.3 drawing decoder. Always returns `null` —
 * no `draw.*` primitives exist yet, so adapters that receive a
 * `DrawingEmission` should drop it with `unsupported-drawing-kind`
 * (which `validateEmission` already enforces). Phase 3 replaces this
 * with the full discriminated `DrawingState` decoder.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { decodeDrawing } from "@invinite-org/chartlang-adapter-kit";
 *
 *     declare const e: import("@invinite-org/chartlang-adapter-kit").DrawingEmission;
 *     const decoded = decodeDrawing(e);
 *     console.log(decoded); // null
 */
export function decodeDrawing(_e: DrawingEmission): null {
    return null;
}
