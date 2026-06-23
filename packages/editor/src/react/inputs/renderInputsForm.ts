// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type {
    InputDescriptor,
    InputKind,
    ScriptManifest,
    SourceField,
} from "@invinite-org/chartlang-core";

/**
 * Select option exposed by the headless inputs ViewModel.
 *
 * @since 0.4
 * @stable
 * @example
 *     const option: InputsFormOption = { value: "1D", label: "1 day" };
 *     void option;
 */
export type InputsFormOption = Readonly<{ value: string; label: string }>;

/**
 * One renderable script input field.
 *
 * @since 0.4
 * @stable
 * @example
 *     declare const field: InputsFormField;
 *     field.onChange(field.value);
 */
export type InputsFormField = Readonly<{
    key: string;
    kind: InputKind;
    title: string;
    value: unknown;
    onChange: (next: unknown) => void;
    options?: ReadonlyArray<InputsFormOption>;
    min?: number;
    max?: number;
    step?: number;
    multiline?: boolean;
    readonly?: boolean;
}>;

/**
 * Framework-agnostic script inputs ViewModel.
 *
 * @since 0.4
 * @stable
 * @example
 *     declare const vm: InputsFormViewModel;
 *     const count = vm.fields.length;
 *     void count;
 */
export type InputsFormViewModel = Readonly<{
    fields: ReadonlyArray<InputsFormField>;
}>;

const SOURCE_FIELDS: ReadonlyArray<SourceField> = Object.freeze([
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
 * Build a framework-agnostic ViewModel from a script manifest and current
 * user-supplied input values.
 *
 * @since 0.4
 * @stable
 * @example
 *     declare const manifest: ScriptManifest;
 *     const vm = renderInputsForm(manifest, {}, (next) => {
 *         void next;
 *     });
 *     void vm.fields;
 */
export function renderInputsForm(
    manifest: ScriptManifest,
    value: Readonly<Record<string, unknown>>,
    onChange: (next: Readonly<Record<string, unknown>>) => void,
    capabilities?: Capabilities,
): InputsFormViewModel {
    const fields = Object.entries(manifest.inputs).map(([key, descriptor]) =>
        buildField(key, descriptor, value, onChange, capabilities),
    );
    return Object.freeze({ fields: Object.freeze(fields) });
}

function buildField(
    key: string,
    descriptor: InputDescriptor<unknown>,
    value: Readonly<Record<string, unknown>>,
    onChange: (next: Readonly<Record<string, unknown>>) => void,
    capabilities: Capabilities | undefined,
): InputsFormField {
    const currentValue = Object.hasOwn(value, key) ? value[key] : defaultValueFor(descriptor);
    const common = {
        key,
        kind: descriptor.kind,
        title: titleFor(key, descriptor),
        value: currentValue,
        onChange: (next: unknown) => onChange(Object.freeze({ ...value, [key]: next })),
    };

    switch (descriptor.kind) {
        case "int":
        case "float":
            return Object.freeze({
                ...common,
                ...numberConstraints(descriptor),
            });
        case "price":
        case "time":
        case "bool":
        case "color":
        case "symbol":
        case "session":
            return Object.freeze(common);
        case "string":
            return Object.freeze({
                ...common,
                ...(descriptor.multiline === undefined ? {} : { multiline: descriptor.multiline }),
            });
        case "enum":
            return Object.freeze({ ...common, options: toOptions(descriptor.options) });
        case "source":
            return Object.freeze({ ...common, options: toOptions(SOURCE_FIELDS) });
        case "interval":
            return Object.freeze({
                ...common,
                ...(capabilities === undefined
                    ? {}
                    : {
                          options: capabilities.intervals.map((interval) => ({
                              value: interval.value,
                              label: interval.label,
                          })),
                      }),
            });
        case "external-series":
            return Object.freeze({ ...common, readonly: true });
    }
}

function numberConstraints(
    descriptor: Readonly<{ min?: number; max?: number; step?: number }>,
): Readonly<{ min?: number; max?: number; step?: number }> {
    return Object.freeze({
        ...(descriptor.min === undefined ? {} : { min: descriptor.min }),
        ...(descriptor.max === undefined ? {} : { max: descriptor.max }),
        ...(descriptor.step === undefined ? {} : { step: descriptor.step }),
    });
}

function defaultValueFor(descriptor: InputDescriptor<unknown>): unknown {
    if (descriptor.kind === "external-series") return undefined;
    return descriptor.defaultValue;
}

function titleFor(key: string, descriptor: InputDescriptor<unknown>): string {
    if (descriptor.title !== undefined) return descriptor.title;
    if (descriptor.kind === "external-series") return descriptor.name;
    return key;
}

function toOptions(values: ReadonlyArray<string>): ReadonlyArray<InputsFormOption> {
    return Object.freeze(values.map((item) => Object.freeze({ value: item, label: item })));
}
