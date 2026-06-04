// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Phase-1 stub for input-schema extraction. `input.*` builders aren't part
 * of the Phase-1 core surface (they land in Phase 4); the function ships as
 * a placeholder so the driver can call it unconditionally and Phase-4 work
 * can extend it without an API change.
 *
 * Always returns an empty `inputs` object and `userPickableInterval: false`.
 *
 * @since 0.1
 * @example
 *     const r: ExtractInputsResult = extractInputs();
 *     void r;
 */
export type ExtractInputsResult = Readonly<{
    inputs: Readonly<Record<string, unknown>>;
    userPickableInterval: boolean;
}>;

/**
 * Return the Phase-1 input schema for any script: empty + non-pickable.
 *
 * @since 0.1
 * @example
 *     // const { inputs, userPickableInterval } = extractInputs();
 *     const fn: typeof extractInputs = extractInputs;
 *     void fn;
 */
export function extractInputs(): ExtractInputsResult {
    return Object.freeze({
        inputs: Object.freeze({}),
        userPickableInterval: false,
    });
}
