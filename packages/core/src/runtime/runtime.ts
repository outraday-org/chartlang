// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "../types.js";

/**
 * Runtime log severity emitted by `runtime.log.*`.
 *
 * @since 0.5
 * @stable
 * @example
 *     const level: LogLevel = "info";
 *     void level;
 */
export type LogLevel = "info" | "warn" | "error";

/**
 * Per-step log message. Pine's `runtime.log.*` analogue. Capability-
 * gated by `Capabilities.logs`; silent no-op when false.
 *
 * @since 0.5
 * @stable
 * @example
 *     // Inside compute:
 *     // runtime.log.info(`ema=${ema.current}`, { ema: ema.current });
 */
function _logInfo(_message: string, _meta?: Readonly<Record<string, JsonValue>>): void {
    throw new Error("runtime.log.info called outside compiled runtime");
}

/**
 * Per-step warning log message. Capability-gated by `Capabilities.logs`.
 *
 * @since 0.5
 * @stable
 * @example
 *     // Inside compute:
 *     // runtime.log.warn("warmup incomplete");
 */
function _logWarn(_message: string, _meta?: Readonly<Record<string, JsonValue>>): void {
    throw new Error("runtime.log.warn called outside compiled runtime");
}

/**
 * Per-step error log message. Capability-gated by `Capabilities.logs`.
 *
 * @since 0.5
 * @stable
 * @example
 *     // Inside compute:
 *     // runtime.log.error("unexpected branch", { branch: "fallback" });
 */
function _logError(_message: string, _meta?: Readonly<Record<string, JsonValue>>): void {
    throw new Error("runtime.log.error called outside compiled runtime");
}

/**
 * Halt the current bar's compute. Emits a fatal `RuntimeDiagnostic`
 * with code `runtime-error-thrown`. The script stays mounted; the
 * next bar runs normally. Use for invariant violations the script
 * cannot continue past.
 *
 * @since 0.5
 * @stable
 * @example
 *     // Inside compute:
 *     // if (inputs.length < 1) runtime.error("length must be >= 1");
 */
function _error(_message: string): never {
    throw new Error("runtime.error called outside compiled runtime");
}

/**
 * Pine-style runtime utilities exposed to script `compute` callbacks.
 *
 * @since 0.5
 * @stable
 * @example
 *     // Inside compute:
 *     // runtime.log.info("close", { value: bar.close });
 */
export const runtime = Object.freeze({
    log: Object.freeze({
        info: _logInfo,
        warn: _logWarn,
        error: _logError,
    }),
    error: _error,
});

/**
 * Script-facing runtime namespace type.
 *
 * @since 0.5
 * @stable
 * @example
 *     const ns: RuntimeNamespace = runtime;
 *     void ns;
 */
export type RuntimeNamespace = typeof runtime;
