// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { InputDescriptor, ScriptManifest } from "@invinite-org/chartlang-core";

import type { RuntimeContext } from "../runtimeContext.js";

const SOURCE_FIELDS = new Set<string>([
    "open",
    "high",
    "low",
    "close",
    "hl2",
    "hlc3",
    "ohlc4",
    "hlcc4",
]);

/**
 * Resolve the script's effective `inputs` bag from manifest defaults plus
 * optional adapter-supplied overrides. Type-incompatible overrides fall back
 * to the descriptor default and emit `input-coercion-failed` once per
 * mount/key.
 *
 * @since 0.4
 * @stable
 * @example
 *     // import { resolveInputs } from "@invinite-org/chartlang-runtime";
 *     // const inputs = resolveInputs(manifest, { length: 20 }, ctx);
 *     const fn: typeof resolveInputs = resolveInputs;
 *     void fn;
 */
export function resolveInputs(
    manifest: ScriptManifest,
    overrides: Readonly<Record<string, unknown>>,
    ctx: RuntimeContext,
): Readonly<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(manifest.inputs)) {
        const fallback = defaultValueFor(descriptor);
        if (!Object.hasOwn(overrides, key) || overrides[key] === undefined) {
            out[key] = fallback;
            continue;
        }
        const override = overrides[key];
        if (matchesDescriptor(descriptor, override)) {
            out[key] = override;
            continue;
        }
        pushInputDiagnostic(ctx, key, descriptor.kind, override);
        out[key] = fallback;
    }
    return Object.freeze(out);
}

function defaultValueFor(descriptor: InputDescriptor<unknown>): unknown {
    if ("defaultValue" in descriptor) return descriptor.defaultValue;
    return undefined;
}

function matchesDescriptor(descriptor: InputDescriptor<unknown>, value: unknown): boolean {
    switch (descriptor.kind) {
        case "int":
            return typeof value === "number" && Number.isInteger(value);
        case "float":
        case "time":
        case "price":
            return typeof value === "number" && Number.isFinite(value);
        case "bool":
            return typeof value === "boolean";
        case "string":
        case "color":
        case "symbol":
        case "interval":
            return typeof value === "string";
        case "enum":
            return typeof value === "string" && descriptor.options.includes(value);
        case "source":
            return typeof value === "string" && SOURCE_FIELDS.has(value);
        case "external-series":
            return value !== null && typeof value === "object";
    }
}

function pushInputDiagnostic(
    ctx: RuntimeContext,
    key: string,
    expected: string,
    value: unknown,
): void {
    if (ctx.diagnosedInputKeys.has(key)) return;
    ctx.diagnosedInputKeys.add(key);
    ctx.emissions.diagnostics.push({
        kind: "diagnostic",
        severity: "warning",
        code: "input-coercion-failed",
        message: `input "${key}" expected ${expected}, got ${describeValue(value)}`,
        slotId: key,
        bar: null,
    });
}

function describeValue(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "number" && Number.isNaN(value)) return "NaN";
    return typeof value;
}
