// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import { validateEmission } from "@invinite-org/chartlang-adapter-kit";
import { bucketFor, type DrawingBucket } from "@invinite-org/chartlang-core";

import type { RuntimeContext } from "../../runtimeContext.js";
import { pushDiagnostic } from "../emissionsQueue.js";

function effectiveBudget(ctx: RuntimeContext, bucket: DrawingBucket): number {
    const adapterCap = ctx.capabilities.maxDrawingsPerScript[bucket];
    const scriptCap = ctx.scriptMaxDrawings?.[bucket] ?? Number.POSITIVE_INFINITY;
    return Math.min(adapterCap, scriptCap);
}

/**
 * Push a {@link DrawingEmission} through the §10/§7.4 enforcement
 * pipeline:
 *
 * 1. **Capability gate** — drop with `unsupported-drawing-kind` if
 *    `ctx.capabilities.drawings` does not include `e.drawingKind`.
 * 2. **Wire-shape validation** — drop with `malformed-emission`
 *    (or `unsupported-drawing-kind` for unknown kinds) if
 *    `validateEmission` rejects the payload. Adapter-kit ships
 *    per-kind validators (Task 2 + per-port tasks 5–18); unknown
 *    kinds fail at step 1 before reaching here.
 * 3. **Bucket budget** — on `op: "create"`, drop with
 *    `drawing-budget-exceeded` if the bucket counter has reached
 *    its effective cap (`min(scriptMaxDrawings, adapter cap)`).
 *    On success, increment the counter. On `op: "remove"`,
 *    decrement (clamped at zero). `op: "update"` is free.
 * 4. **Per-bar `(handleId, bar)` dedup** — replace any prior
 *    in-bar emission for the same handle (last-write-wins).
 *
 * On any drop path, the original emission does not reach
 * `ctx.emissions.drawings`; a diagnostic with the appropriate code
 * lands on `ctx.emissions.diagnostics` instead.
 *
 * @since 0.3
 * @stable
 * @example
 *     // import { pushDrawing } from "@invinite-org/chartlang-runtime";
 *     // pushDrawing(ctx, {
 *     //     kind: "drawing",
 *     //     handleId: "x.chart.ts:1:1#0",
 *     //     drawingKind: "line",
 *     //     op: "create",
 *     //     state: {
 *     //         kind: "line",
 *     //         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *     //         style: {},
 *     //     },
 *     //     bar: 0,
 *     //     time: 0,
 *     // });
 */
export function pushDrawing(ctx: RuntimeContext, e: DrawingEmission): void {
    if (!ctx.capabilities.drawings.has(e.drawingKind)) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-drawing-kind",
            message: `Adapter cannot render drawing kind "${e.drawingKind}".`,
            slotId: e.handleId,
            bar: e.bar,
        });
        return;
    }

    const validation = validateEmission(e);
    if (!validation.ok) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: validation.code,
            message: validation.message,
            slotId: e.handleId,
            bar: e.bar,
        });
        return;
    }

    const bucket = bucketFor(e.drawingKind);
    if (e.op === "create") {
        const used = ctx.drawingBucketCounters[bucket];
        const cap = effectiveBudget(ctx, bucket);
        if (used >= cap) {
            pushDiagnostic(ctx.emissions, {
                kind: "diagnostic",
                severity: "warning",
                code: "drawing-budget-exceeded",
                message: `Bucket '${bucket}' budget (${cap}) exhausted; drawing dropped.`,
                slotId: e.handleId,
                bar: e.bar,
            });
            return;
        }
        ctx.drawingBucketCounters[bucket] = used + 1;
    } else if (e.op === "remove") {
        const used = ctx.drawingBucketCounters[bucket];
        ctx.drawingBucketCounters[bucket] = Math.max(0, used - 1);
    }

    const drawings = ctx.emissions.drawings;
    for (let i = drawings.length - 1; i >= 0; i -= 1) {
        const existing = drawings[i];
        if (existing.handleId === e.handleId && existing.bar === e.bar) {
            drawings[i] = e;
            return;
        }
    }
    drawings.push(e);
}
