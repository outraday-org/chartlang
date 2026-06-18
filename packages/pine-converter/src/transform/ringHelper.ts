// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingCallSite } from "../semantic/index.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ChartlangDrawKind } from "./handleSlot.js";
import type { ScriptScaffold } from "./ir.js";
import type { NameAllocator } from "./nameAllocator.js";
import { appendHandleRing } from "./scaffoldMutators.js";

/**
 * The Pine drawing-collection families a Camp B ring buffer is built from.
 * `linefill`/`table` never reach Camp B (the former rejects, the latter has
 * no collection idiom), so the ring buckets are exactly these four.
 *
 * @since 0.1
 * @stable
 * @example
 *     const b: RingBucket = "line";
 *     void b;
 */
export type RingBucket = "line" | "box" | "label" | "polyline";

/**
 * The chartlang per-bucket ring capacity ceiling, mirroring core's
 * `DrawingCounts` budgets. A Pine eviction cap above the ceiling is clamped
 * to it (the runtime GCs anyway); `polyline` is the tighter `100` bucket.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { CHARTLANG_BUCKET_CAP } from "./ringHelper.js";
 *     CHARTLANG_BUCKET_CAP.line; // 500
 */
export const CHARTLANG_BUCKET_CAP: Readonly<Record<RingBucket, number>> = {
    line: 500,
    box: 500,
    label: 500,
    polyline: 100,
};

/**
 * Allocate the module-level ring local a Pine drawing collection binds to,
 * REUSING the Pine collection identifier so a `var array<line> lvls` becomes
 * `lvls` (collision-disambiguated only when already emitted). Codegen emits the
 * matching `const lvls = useDrawingHandleRing<"line">(<cap>);` allocation and
 * Camp B / Camp C reference this name. Allocate ONCE per collection (a second
 * `array.push` site into the same collection is deduped by `registerRing`
 * before this is reached). Route through the scaffold's {@link NameAllocator},
 * never inline a prefix/suffix.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { ringLocalName } from "./ringHelper.js";
 *     import { NameAllocator } from "./nameAllocator.js";
 *     ringLocalName("lvls", new NameAllocator(["lvls"])); // "lvls"
 */
export function ringLocalName(collectionName: string, names: NameAllocator): string {
    return names.allocateForSymbol(collectionName);
}

/**
 * Resolve the ring capacity `K = min(pineCap, CHARTLANG_BUCKET_CAP[bucket])`
 * for a Camp B site. Emits `cap-mismatch` (info) once when the bucket clamp
 * actually lowered the Pine cap, and `ring-buffer-zero-cap` (error) +
 * returns `null` when `K <= 0` (a zero or negative Pine cap). The clamp keeps
 * the ring within the chartlang per-bucket draw budget.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { resolveRingCap } from "./ringHelper.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     declare const site: import("../semantic/index.js").DrawingCallSite;
 *     resolveRingCap(site, new DiagnosticCollector());
 */
export function resolveRingCap(
    site: DrawingCallSite,
    diagnostics: DiagnosticCollector,
): number | null {
    if (site.camp.kind !== "camp-b") {
        return null;
    }
    const pineCap = site.camp.cap;
    const bucketCap = CHARTLANG_BUCKET_CAP[site.handleType as RingBucket];
    const k = Math.min(pineCap, bucketCap);
    if (k <= 0) {
        diagnostics.pushCode("ring-buffer-zero-cap", site.span);
        return null;
    }
    if (k < pineCap) {
        diagnostics.pushCode("cap-mismatch", site.span);
    }
    return k;
}

/**
 * Register the module-level handle ring for a Pine drawing collection and
 * return its chartlang local. Wraps {@link appendHandleRing}; Task 16 codegen
 * reads `scaffold.handleRings` to emit the `useDrawingHandleRing` allocation.
 * Camp B and Camp C share this so the ring local + IR shape stay in lockstep.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { registerRing } from "./ringHelper.js";
 *     import type { ScriptScaffold } from "./ir.js";
 *     declare const scaffold: ScriptScaffold;
 *     registerRing(scaffold, "lvls", "line", 50); // "lvls"
 */
export function registerRing(
    scaffold: ScriptScaffold,
    collectionName: string,
    kind: ChartlangDrawKind,
    cap: number,
): string {
    // `ringLocalName` is idempotent per collection (memoized in the allocator),
    // so two `array.push` sites into one collection resolve the same name;
    // `appendHandleRing` then dedups the IR entry by that name.
    const name = ringLocalName(collectionName, scaffold.names);
    appendHandleRing(scaffold, { name, kind, cap });
    return name;
}
