// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DiagnosticCode } from "@invinite-org/chartlang-adapter-kit";
import type {
    RequestNamespace,
    RequestSecurityOpts,
    SecurityBar,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeNanSecurityBar } from "./securityBarStub";

function cacheKey(slotId: string, interval: string): string {
    return `${slotId}|${interval}`;
}

function diagnosticKey(code: DiagnosticCode, slotId: string, interval: string): string {
    return `${code}|${slotId}|${interval}`;
}

function getCtx(name: string): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error(`${name} called outside an active script step`);
    }
    return ctx;
}

function pushOnce(
    ctx: RuntimeContext,
    code: "unsupported-interval" | "multi-timeframe-not-supported",
    slotId: string,
    interval: string,
    message: string,
): void {
    const key = diagnosticKey(code, slotId, interval);
    if (ctx.diagnosedRequestKeys.has(key)) return;
    ctx.diagnosedRequestKeys.add(key);
    ctx.emissions.diagnostics.push({
        kind: "diagnostic",
        severity: "warning",
        code,
        message,
        slotId,
        bar: ctx.barIndex(),
    });
}

function security(slotId: string, opts: RequestSecurityOpts): SecurityBar {
    const ctx = getCtx("request.security");
    const key = cacheKey(slotId, opts.interval);
    const existing = ctx.requestSecurityBars.get(key);
    if (existing !== undefined) return existing;

    const known = ctx.capabilities.intervals.some(
        (descriptor) => descriptor.value === opts.interval,
    );
    if (!known) {
        pushOnce(
            ctx,
            "unsupported-interval",
            slotId,
            opts.interval,
            `Requested interval "${opts.interval}" is not in Capabilities.intervals`,
        );
    } else if (!ctx.capabilities.multiTimeframe) {
        pushOnce(
            ctx,
            "multi-timeframe-not-supported",
            slotId,
            opts.interval,
            "Adapter declares multiTimeframe: false; request.security returns NaN",
        );
    }

    const bar = makeNanSecurityBar();
    ctx.requestSecurityBars.set(key, bar);
    return bar;
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
    const ns = Object.freeze({ security });
    return ns as unknown as RequestNamespace;
}
