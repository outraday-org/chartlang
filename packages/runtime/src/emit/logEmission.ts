// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue, LogLevel, RuntimeNamespace } from "@invinite-org/chartlang-core";
import type { LogEmission } from "@invinite-org/chartlang-adapter-kit";

import type { RuntimeContext } from "../runtimeContext.js";
import { pushDiagnostic, pushLog } from "./emissionsQueue.js";
import { makeRuntimeErrorHalt } from "./runtimeError.js";
import { snapshotMeta } from "./snapshotMeta.js";

const MAX_LOGS_PER_STEP = 1000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
    // The null guard stays because `Object.getPrototypeOf(null)` throws, but
    // `isJsonValue` — the only caller — answers `null` before reaching here.
    /* v8 ignore next -- null is already gated by isJsonValue */
    if (typeof v !== "object" || v === null) return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}

function isJsonValue(v: unknown): v is JsonValue {
    if (v === null) return true;
    const t = typeof v;
    if (t === "boolean" || t === "string") return true;
    if (t === "number") return Number.isFinite(v);
    if (Array.isArray(v)) return v.every(isJsonValue);
    if (!isPlainObject(v)) return false;
    for (const key of Object.keys(v)) {
        let child: unknown;
        try {
            child = Reflect.get(v, key);
        } catch {
            return false;
        }
        if (!isJsonValue(child)) return false;
    }
    return true;
}

function diagnoseLogBudget(ctx: RuntimeContext): void {
    if (ctx.logBudgetExceededDiagnosed) return;
    ctx.logBudgetExceededDiagnosed = true;
    pushDiagnostic(ctx.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "runtime-log-budget-exceeded",
        message:
            "runtime.log.* emitted more than 1000 messages in one compute step; later logs were dropped.",
        slotId: null,
        bar: ctx.barIndex(),
    });
}

/**
 * Emit one `runtime.log.*` message for the active compute step.
 *
 * @since 0.5
 * @stable
 * @example
 *     // emitLog(ctx, "info", "ready");
 *     const fn: typeof emitLog = emitLog;
 *     void fn;
 */
export function emitLog(
    ctx: RuntimeContext,
    level: LogLevel,
    message: string,
    meta?: Readonly<Record<string, JsonValue>>,
): void {
    if (!ctx.capabilities.logs) return;
    if (ctx.logBudget >= MAX_LOGS_PER_STEP) {
        diagnoseLogBudget(ctx);
        return;
    }
    if (meta !== undefined && !isJsonValue(meta)) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "malformed-log-meta",
            message: "runtime.log.* meta must be JSON-serialisable.",
            slotId: null,
            bar: ctx.barIndex(),
        });
        return;
    }
    const emission: LogEmission = {
        kind: "log",
        level,
        message,
        ...(meta === undefined ? {} : { meta: snapshotMeta(meta) }),
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
    };
    ctx.logBudget += 1;
    pushLog(ctx.emissions, emission);
}

/**
 * Build the script-facing runtime namespace bound to a runtime context.
 *
 * @since 0.5
 * @stable
 * @example
 *     // const ns = buildRuntimeNamespace(ctx);
 *     const fn: typeof buildRuntimeNamespace = buildRuntimeNamespace;
 *     void fn;
 */
export function buildRuntimeNamespace(ctx: RuntimeContext): RuntimeNamespace {
    return Object.freeze({
        log: Object.freeze({
            info: (message: string, meta?: Readonly<Record<string, JsonValue>>) =>
                emitLog(ctx, "info", message, meta),
            warn: (message: string, meta?: Readonly<Record<string, JsonValue>>) =>
                emitLog(ctx, "warn", message, meta),
            error: (message: string, meta?: Readonly<Record<string, JsonValue>>) =>
                emitLog(ctx, "error", message, meta),
        }),
        error: (message) => {
            throw makeRuntimeErrorHalt(message);
        },
    });
}
