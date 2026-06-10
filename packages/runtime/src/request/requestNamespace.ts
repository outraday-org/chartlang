// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Bar,
    RequestLowerTfOpts,
    RequestNamespace,
    RequestSecurityOpts,
    SecurityBar,
    Series,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeLowerTfSeries } from "./lowerTf.js";
import { makeSecurityBar } from "./security.js";

function getCtx(name: string): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error(`${name} called outside an active script step`);
    }
    return ctx;
}

function security(slotId: string, opts: RequestSecurityOpts): SecurityBar {
    const ctx = getCtx("request.security");
    return makeSecurityBar(ctx, slotId, opts.interval);
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
