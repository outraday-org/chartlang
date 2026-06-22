// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Bar,
    RequestLowerTfOpts,
    RequestNamespace,
    RequestSecurityOpts,
    SecurityBar,
    SecurityExpr,
    Series,
} from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeLowerTfSeries } from "./lowerTf.js";
import { makeSecurityBar, makeSecurityExprSeries } from "./security.js";
import { captureAndCatchUp } from "./securityExprRunner.js";

function getCtx(name: string): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error(`${name} called outside an active script step`);
    }
    return ctx;
}

// Resolve a requested symbol to the value the secondary stream is keyed under.
// An omitted symbol — or the chart's own ticker passed explicitly — collapses
// to `undefined` so `feedKey` produces the bare interval, hitting the same
// stream as the omitted-symbol form (no duplicate) and staying byte-identical
// to the pre-multi-symbol baseline. Only a *different* symbol survives as the
// `"<symbol>@<interval>"` feed.
function resolveSymbol(ctx: RuntimeContext, symbol: string | undefined): string | undefined {
    return symbol === undefined || symbol === ctx.chartSymbol ? undefined : symbol;
}

// Dispatch off the runner registry (not `expr !== undefined`) so compiled
// output stays robust if the emitted call shape changes: a slotId the compiler
// recorded in `manifest.securityExpressions` is always an expression unit.
function security(
    slotId: string,
    opts: RequestSecurityOpts,
    expr?: SecurityExpr,
): SecurityBar | Series<number> {
    const ctx = getCtx("request.security");
    const symbol = resolveSymbol(ctx, opts.symbol);
    const feed = feedKey(symbol, opts.interval);
    const runner = ctx.securityExprRunners?.get(slotId);
    if (runner === undefined) {
        return makeSecurityBar(ctx, slotId, symbol, opts.interval);
    }
    if (expr !== undefined) {
        const secondary = ctx.secondaryStreams.get(feed);
        if (secondary !== undefined) captureAndCatchUp(runner, expr, secondary);
    }
    // `resolveSymbol` collapses an omitted / chart-symbol request to `undefined`,
    // so a defined `symbol` is always a DIFFERENT symbol (the `multiSymbol` gate).
    return makeSecurityExprSeries(ctx, runner, feed, symbol !== undefined);
}

function lowerTf(slotId: string, opts: RequestLowerTfOpts): Series<ReadonlyArray<Bar>> {
    const ctx = getCtx("request.lowerTf");
    return makeLowerTfSeries(ctx, slotId, opts.interval);
}

/**
 * Build the runtime `request` namespace installed on `ComputeContext`.
 *
 * The implementation accepts the compiler-injected `slotId` as its first
 * parameter even though the public core type is script-facing
 * `request.security(opts)`. This mirrors the existing slot-aware `state.*`
 * runtime namespace.
 *
 * @since 0.4
 * @stable
 * @example
 *     const ns = buildRequestNamespace();
 *     void ns.security;
 */
export function buildRequestNamespace(): RequestNamespace {
    const ns = Object.freeze({ security, lowerTf });
    return ns as unknown as RequestNamespace;
}
