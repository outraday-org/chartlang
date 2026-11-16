// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { InputDescriptor, ScriptManifest } from "@invinite-org/chartlang-core";

const SOURCE_FIELDS: ReadonlySet<string> = new Set([
    "open",
    "high",
    "low",
    "close",
    "hl2",
    "hlc3",
    "ohlc4",
    "hlcc4",
]);

function describe(value: unknown): string {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return value === null ? "null" : typeof value;
}

type ScalarDescriptor = Exclude<InputDescriptor<unknown>, Readonly<{ kind: "external-series" }>>;

function problemFor(key: string, descriptor: ScalarDescriptor, value: unknown): string | null {
    switch (descriptor.kind) {
        case "int":
        case "float": {
            const ok =
                typeof value === "number" &&
                Number.isFinite(value) &&
                (descriptor.kind === "float" || Number.isInteger(value));
            if (!ok) return `input "${key}" expected ${descriptor.kind}, got ${describe(value)}`;
            if (descriptor.min !== undefined && value < descriptor.min) {
                return `input "${key}" is ${value}, below its minimum ${descriptor.min}`;
            }
            if (descriptor.max !== undefined && value > descriptor.max) {
                return `input "${key}" is ${value}, above its maximum ${descriptor.max}`;
            }
            return null;
        }
        case "time":
        case "price":
            return typeof value === "number" && Number.isFinite(value)
                ? null
                : `input "${key}" expected ${descriptor.kind}, got ${describe(value)}`;
        case "bool":
            return typeof value === "boolean"
                ? null
                : `input "${key}" expected bool, got ${describe(value)}`;
        case "string":
        case "color":
        case "symbol":
        case "interval":
        case "session":
            return typeof value === "string"
                ? null
                : `input "${key}" expected ${descriptor.kind}, got ${describe(value)}`;
        case "enum":
            return (typeof value === "string" || typeof value === "number") &&
                descriptor.options.includes(value)
                ? null
                : `input "${key}" must be one of ${JSON.stringify(descriptor.options)}, got ${describe(value)}`;
        case "source":
            return typeof value === "string" && SOURCE_FIELDS.has(value)
                ? null
                : `input "${key}" expected a bar source (${[...SOURCE_FIELDS].join(", ")}), got ${describe(value)}`;
    }
}

/**
 * Check user inputs against a manifest's input schema, strictly: an unknown
 * key, a value of the wrong kind, a number outside `min` / `max`, an enum
 * value outside `options`, and any `external-series` input (the runner has no
 * feed for it) are problems. Omitted keys are fine — they take the script's
 * default. Returns one human-readable line per problem, `[]` when valid.
 *
 * The runtime itself would silently fall back to the default on a bad value;
 * a hosted alert should refuse instead, which is why `createAlertRunner`
 * throws `"invalid-inputs"` on any problem this reports.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { validateAlertInputs } from "@invinite-org/chartlang-alert-runner";
 *     declare const manifest: Parameters<typeof validateAlertInputs>[0];
 *     const problems = validateAlertInputs(manifest, { length: 14 });
 *     void problems;
 */
export function validateAlertInputs(
    manifest: ScriptManifest,
    inputs: Readonly<Record<string, unknown>>,
): ReadonlyArray<string> {
    const problems: string[] = [];
    for (const [key, descriptor] of Object.entries(manifest.inputs)) {
        if (descriptor.kind === "external-series") {
            problems.push(
                `input "${key}" is an external series, which the alert runner cannot feed`,
            );
            continue;
        }
        if (!Object.hasOwn(inputs, key) || inputs[key] === undefined) continue;
        const problem = problemFor(key, descriptor, inputs[key]);
        if (problem !== null) problems.push(problem);
    }
    for (const [key, value] of Object.entries(inputs)) {
        if (value !== undefined && !Object.hasOwn(manifest.inputs, key))
            problems.push(`input "${key}" is not declared by the script`);
    }
    return problems;
}
