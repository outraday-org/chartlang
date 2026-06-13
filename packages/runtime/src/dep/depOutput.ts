// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";

import { pushDiagnostic } from "../emit/emissionsQueue.js";
import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";

/**
 * The well-known property on `globalThis` the compiler-emitted bundle's
 * inline shim looks for. Set once by {@link installDepOutputGlobal}.
 *
 * @since 0.7
 * @stable
 * @example
 *     // import { DEP_OUTPUT_GLOBAL_KEY } from "@invinite-org/chartlang-runtime/internal";
 *     // const fn = (globalThis as Record<string, unknown>)[DEP_OUTPUT_GLOBAL_KEY];
 *     // void fn;
 */
export const DEP_OUTPUT_GLOBAL_KEY = "__chartlang_depOutput" as const;

const OUTSIDE_CTX_MESSAGE = "__chartlang_depOutput called outside an active script step";
const NO_STORE_MESSAGE = "__chartlang_depOutput called on a runner with no dep output store";

/**
 * Sentinel `Series<number>` whose every read returns `NaN`. Returned by
 * the helper when the consumer asks for an output that the producer
 * never declared (compile-time error from Task 2; runtime sanity
 * fallback). The buffer never receives a write, so all reads stay NaN.
 */
const NAN_SERIES: Series<number> = makeSeriesView<number>(new Float64RingBuffer(1));

/**
 * Runtime helper invoked by the compiler-emitted bundle in place of
 * every consumer-side `<binding>.output("title")` call. Tasks 2 + 3
 * rewrite each call site to
 * `__chartlang_depOutput(slotId, localId, title)`; the runtime returns
 * the producer's stable `Series<number>` view from the active runner's
 * `DepOutputStore`.
 *
 * The helper is exposed via the `@invinite-org/chartlang-runtime/internal`
 * subpath only — user scripts can't import it. {@link installDepOutputGlobal}
 * also assigns it to `globalThis.__chartlang_depOutput` so the bundle's
 * inline shim picks it up automatically.
 *
 * @since 0.7
 * @stable
 * @example
 *     // import { __chartlang_depOutput } from "@invinite-org/chartlang-runtime/internal";
 *     // const line = __chartlang_depOutput("demo.chart.ts:5:13#0", "fast", "line");
 *     // void line;
 */
export function __chartlang_depOutput(
    slotId: string,
    localId: string,
    title: string,
): Series<number> {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    const store = ctx.depOutputStore;
    if (store === undefined || store === null) {
        throw new Error(NO_STORE_MESSAGE);
    }
    try {
        return store.read(localId, title);
    } catch {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "error",
            code: "dep-unknown-output",
            message: `dep "${localId}" did not declare output "${title}"`,
            slotId,
            bar: ctx.barIndex(),
        });
        return NAN_SERIES;
    }
}

/**
 * Install {@link __chartlang_depOutput} on `globalThis` under the
 * {@link DEP_OUTPUT_GLOBAL_KEY} property. Compiler-emitted bundles
 * reference the global via an inline shim; the runtime calls
 * `installDepOutputGlobal` from `createScriptRunner` when mounting a
 * `CompiledScriptBundle`. The assignment is idempotent — subsequent
 * calls leave the existing value untouched.
 *
 * @since 0.7
 * @stable
 * @example
 *     // import { installDepOutputGlobal } from "@invinite-org/chartlang-runtime/internal";
 *     // installDepOutputGlobal();
 */
export function installDepOutputGlobal(): void {
    const holder = globalThis as Record<string, unknown>;
    if (holder[DEP_OUTPUT_GLOBAL_KEY] === undefined) {
        holder[DEP_OUTPUT_GLOBAL_KEY] = __chartlang_depOutput;
    }
}
