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

// Dispatch off the runner registry (not `expr !== undefined`) so compiled
// output stays robust if the emitted call shape changes: a slotId the compiler
// recorded in `manifest.securityExpressions` is always an expression unit.
function security(
    slotId: string,
    opts: RequestSecurityOpts,
    expr?: SecurityExpr,
): SecurityBar | Series<number> {
    const ctx = getCtx("request.security");
    const runner = ctx.securityExprRunners?.get(slotId);
    if (runner === undefined) {
        return makeSecurityBar(ctx, slotId, opts.interval);
    }
    if (expr !== undefined) {
        const secondary = ctx.secondaryStreams.get(opts.interval);
        if (secondary !== undefined) captureAndCatchUp(runner, expr, secondary);
    }
    return makeSecurityExprSeries(ctx, runner, opts.interval);
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
