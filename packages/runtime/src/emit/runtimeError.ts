// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const RUNTIME_ERROR_SENTINEL = Symbol("runtime-error-halt");

type RuntimeErrorHalt = Readonly<{
    sentinel: typeof RUNTIME_ERROR_SENTINEL;
    message: string;
}>;

/**
 * Create the private sentinel thrown by `runtime.error(...)`.
 *
 * @since 0.5
 * @stable
 * @example
 *     const halt = makeRuntimeErrorHalt("invariant");
 *     void halt;
 */
export function makeRuntimeErrorHalt(message: string): RuntimeErrorHalt {
    return Object.freeze({ sentinel: RUNTIME_ERROR_SENTINEL, message });
}

/**
 * Identify the private `runtime.error(...)` halt sentinel.
 *
 * @since 0.5
 * @stable
 * @example
 *     const hit = isRuntimeErrorHalt(makeRuntimeErrorHalt("x"));
 *     void hit;
 */
export function isRuntimeErrorHalt(err: unknown): err is RuntimeErrorHalt {
    return (
        typeof err === "object" &&
        err !== null &&
        "sentinel" in err &&
        (err as { readonly sentinel?: unknown }).sentinel === RUNTIME_ERROR_SENTINEL &&
        "message" in err &&
        typeof (err as { readonly message?: unknown }).message === "string"
    );
}
