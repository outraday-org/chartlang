// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ReactElement } from "react";

import { renderInputsForm, type InputsFormField } from "./renderInputsForm.js";

/**
 * Props for the React script inputs form binding.
 *
 * @since 0.4
 * @stable
 * @example
 *     declare const manifest: InputsFormProps["manifest"];
 *     const props: InputsFormProps = {
 *         manifest,
 *         value: {},
 *         onChange: () => undefined,
 *     };
 *     void props;
 */
export type InputsFormProps = Readonly<{
    manifest: Parameters<typeof renderInputsForm>[0];
    value: Parameters<typeof renderInputsForm>[1];
    onChange: Parameters<typeof renderInputsForm>[2];
    capabilities?: Parameters<typeof renderInputsForm>[3];
    className?: string;
}>;

/**
 * Render script manifest inputs as native HTML form controls.
 *
 * @since 0.4
 * @stable
 * @example
 *     declare const manifest: InputsFormProps["manifest"];
 *     const element = <InputsForm manifest={manifest} value={{}} onChange={() => undefined} />;
 *     void element;
 */
export function InputsForm(props: InputsFormProps): ReactElement {
    const vm = renderInputsForm(props.manifest, props.value, props.onChange, props.capabilities);
    return (
        <form
            className={props.className ?? "chartlang-inputs-form"}
            onSubmit={(event) => event.preventDefault()}
        >
            {vm.fields.map((field) => (
                <FieldView field={field} key={field.key} />
            ))}
        </form>
    );
}

function FieldView({ field }: Readonly<{ field: InputsFormField }>): ReactElement {
    switch (field.kind) {
        case "int":
        case "float":
        case "price":
        case "time":
            return <NumberField field={field} />;
        case "bool":
            return (
                <label>
                    {field.title}
                    <input
                        checked={Boolean(field.value)}
                        name={field.key}
                        onChange={(event) => field.onChange(event.target.checked)}
                        type="checkbox"
                    />
                </label>
            );
        case "enum":
        case "source":
            return <SelectField field={field} />;
        case "interval":
            return field.options === undefined || field.options.length === 0 ? (
                <TextField field={field} type="text" />
            ) : (
                <SelectField field={field} />
            );
        case "color":
            return <TextField field={field} type="color" />;
        case "string":
            return field.multiline === true ? (
                <TextareaField field={field} />
            ) : (
                <TextField field={field} type="text" />
            );
        case "symbol":
            return <TextField field={field} type="text" />;
        case "external-series":
            return <TextField field={field} disabled={true} type="text" />;
    }
}

function NumberField({ field }: Readonly<{ field: InputsFormField }>): ReactElement {
    return (
        <label>
            {field.title}
            <input
                max={field.max}
                min={field.min}
                name={field.key}
                onChange={(event) => field.onChange(Number(event.target.value))}
                step={field.step}
                type="number"
                value={numberValue(field.value)}
            />
        </label>
    );
}

function SelectField({ field }: Readonly<{ field: InputsFormField }>): ReactElement {
    return (
        <label>
            {field.title}
            <select
                name={field.key}
                onChange={(event) => field.onChange(event.target.value)}
                value={stringValue(field.value)}
            >
                {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function TextField({
    disabled = false,
    field,
    type,
}: Readonly<{
    disabled?: boolean;
    field: InputsFormField;
    type: "color" | "text";
}>): ReactElement {
    return (
        <label>
            {field.title}
            <input
                disabled={disabled || field.readonly === true}
                name={field.key}
                onChange={(event) => field.onChange(event.target.value)}
                type={type}
                value={stringValue(field.value)}
            />
        </label>
    );
}

function TextareaField({ field }: Readonly<{ field: InputsFormField }>): ReactElement {
    return (
        <label>
            {field.title}
            <textarea
                name={field.key}
                onChange={(event) => field.onChange(event.target.value)}
                value={stringValue(field.value)}
            />
        </label>
    );
}

function numberValue(value: unknown): number | string {
    return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function stringValue(value: unknown): string {
    return typeof value === "string" ? value : "";
}
