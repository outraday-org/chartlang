# Task 15 — Editor `/react` sub-export + Inputs UI

> **Status: TODO**

## Goal

Ship the React component layer + inputs UI under
`@invinite-org/chartlang-editor/react`. Land
`<ChartlangEditor />` (CM6 reference editor wrapped in a React
component), a headless `renderInputsForm(manifest, value,
onChange)` ViewModel for any host, and a thin React
`<InputsForm />` binding. Per the
architectural-decision answer: React is **optional** — bare entry
stays framework-agnostic (Task 14).

## Prerequisites

- Task 14 (CM6 factory exists for the React wrapper to mount).

## Current Behavior

- `@invinite-org/chartlang-editor` ships only the CM6 bare entry
  from Task 14.
- No React subpath.
- No Inputs UI.

## Desired Behavior

- `import { ChartlangEditor, InputsForm } from "@invinite-org/
  chartlang-editor/react"` resolves.
- `<ChartlangEditor source onSourceChange targetCapabilities
  onCompiled />` mounts the CM6 editor + manages lifecycle (mount
  / unmount, source sync, capability hot-swap).
- `renderInputsForm(manifest, value, onChange)` returns a typed
  ViewModel describing fields + their current values + change
  hooks — consumable by Monaco / vanilla DOM / Solid / Svelte
  hosts.
- `<InputsForm manifest value onChange />` renders an HTML form
  reflecting the ViewModel — labels, inputs per `InputKind`,
  default → user-supplied value, change emission.
- The `interval` input is a dropdown sourced from
  `targetCapabilities.intervals` (when present); other inputs map
  to native `<input>` types.

## Requirements

### 1. `packages/editor/package.json` — sub-export + deps

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    }
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true }
  },
  "devDependencies": {
    "react": "^18",
    "react-dom": "^18",
    "@testing-library/react": "^15",
    "@types/react": "^18",
    "@types/react-dom": "^18"
  }
}
```

`tsconfig.json` adds a `paths` entry and a `react/` rootDir so
both entries compile in one `tsc` invocation.

### 2. `packages/editor/src/react/ChartlangEditor.tsx`

```tsx
import { useEffect, useRef } from "react";
import { createChartlangEditor, type ChartlangEditor as Ed, type ChartlangEditorOpts } from "../createChartlangEditor";

export type ChartlangEditorProps = Readonly<{
    source: string;
    onSourceChange?: (next: string) => void;
    targetCapabilities?: ChartlangEditorOpts["targetCapabilities"];
    onCompiled?: ChartlangEditorOpts["onCompiled"];
    className?: string;
}>;

export function ChartlangEditor(props: ChartlangEditorProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<Ed | null>(null);
    const sourceRef = useRef<string>(props.source);

    useEffect(() => {
        if (!containerRef.current || editorRef.current) return;
        editorRef.current = createChartlangEditor({
            doc: props.source,
            targetCapabilities: props.targetCapabilities,
            onSourceChange: (next) => { sourceRef.current = next; props.onSourceChange?.(next); },
            onCompiled: props.onCompiled,
            parent: containerRef.current,
        });
        return () => editorRef.current?.destroy();
    }, []);

    // Sync external source changes.
    useEffect(() => {
        if (editorRef.current && props.source !== sourceRef.current) {
            editorRef.current.setSource(props.source);
            sourceRef.current = props.source;
        }
    }, [props.source]);

    // Capability hot-swap.
    useEffect(() => {
        editorRef.current?.setCapabilities(props.targetCapabilities ?? null);
    }, [props.targetCapabilities]);

    return <div ref={containerRef} className={props.className} />;
}
```

### 3. `packages/editor/src/react/inputs/renderInputsForm.ts`

Framework-agnostic ViewModel builder.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";

export type InputsFormField = Readonly<{
    key: string;
    kind: string;
    title: string;
    value: unknown;
    onChange: (next: unknown) => void;
    options?: ReadonlyArray<{ value: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
    multiline?: boolean;
}>;

export type InputsFormViewModel = Readonly<{
    fields: ReadonlyArray<InputsFormField>;
}>;

/**
 * Build a framework-agnostic ViewModel from the script manifest +
 * current user values. The caller wires `onChange` per field to a
 * mutating setter (React useState, MobX, plain DOM listener).
 *
 * @since 0.4
 * @example
 *     // const vm = renderInputsForm(manifest, value, setValue, capabilities);
 *     // vm.fields[0].kind === "int"
 *     const fn: typeof renderInputsForm = renderInputsForm;
 *     void fn;
 */
export function renderInputsForm(
    manifest: ScriptManifest,
    value: Readonly<Record<string, unknown>>,
    onChange: (next: Readonly<Record<string, unknown>>) => void,
    capabilities?: Capabilities,
): InputsFormViewModel {
    const fields: InputsFormField[] = [];
    for (const [key, descriptorRaw] of Object.entries(manifest.inputs)) {
        const d = descriptorRaw as { kind: string; title?: string; defaultValue: unknown; options?: ReadonlyArray<string>; min?: number; max?: number; step?: number; multiline?: boolean };
        const v = value[key] ?? d.defaultValue;
        fields.push({
            key,
            kind: d.kind,
            title: d.title ?? key,
            value: v,
            onChange: (next) => onChange(Object.freeze({ ...value, [key]: next })),
            options: d.kind === "enum"
                ? d.options?.map((o) => ({ value: o, label: o }))
                : d.kind === "interval"
                    ? capabilities?.intervals.map((i) => ({ value: i.value, label: i.label }))
                    : d.kind === "source"
                        ? SOURCE_FIELDS.map((s) => ({ value: s, label: s }))
                        : undefined,
            min: d.min,
            max: d.max,
            step: d.step,
            multiline: d.multiline,
        });
    }
    return Object.freeze({ fields: Object.freeze(fields) });
}

const SOURCE_FIELDS = [
    "open", "high", "low", "close", "hl2", "hlc3", "ohlc4", "hlcc4",
] as const;
```

### 4. `packages/editor/src/react/inputs/InputsForm.tsx`

```tsx
import { renderInputsForm, type InputsFormField } from "./renderInputsForm";

export type InputsFormProps = Readonly<{
    manifest: Parameters<typeof renderInputsForm>[0];
    value: Parameters<typeof renderInputsForm>[1];
    onChange: Parameters<typeof renderInputsForm>[2];
    capabilities?: Parameters<typeof renderInputsForm>[3];
}>;

export function InputsForm(props: InputsFormProps): JSX.Element {
    const vm = renderInputsForm(props.manifest, props.value, props.onChange, props.capabilities);
    return (
        <form className="chartlang-inputs-form">
            {vm.fields.map((f) => <FieldView key={f.key} field={f} />)}
        </form>
    );
}

function FieldView({ field }: { field: InputsFormField }): JSX.Element {
    switch (field.kind) {
        case "int": case "float": case "price": case "time":
            return (
                <label>{field.title}<input type="number" value={Number(field.value)} min={field.min} max={field.max} step={field.step} onChange={(e) => field.onChange(Number(e.target.value))} /></label>
            );
        case "bool":
            return (
                <label>{field.title}<input type="checkbox" checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} /></label>
            );
        case "enum": case "source":
            return (
                <label>{field.title}<select value={String(field.value)} onChange={(e) => field.onChange(e.target.value)}>
                    {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></label>
            );
        case "interval":
            return field.options && field.options.length > 0
                ? (
                    <label>{field.title}<select value={String(field.value)} onChange={(e) => field.onChange(e.target.value)}>
                        {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select></label>
                )
                : <label>{field.title}<input type="text" value={String(field.value)} onChange={(e) => field.onChange(e.target.value)} /></label>;
        case "color":
            return <label>{field.title}<input type="color" value={String(field.value)} onChange={(e) => field.onChange(e.target.value)} /></label>;
        case "string":
            return field.multiline
                ? <label>{field.title}<textarea value={String(field.value)} onChange={(e) => field.onChange(e.target.value)} /></label>
                : <label>{field.title}<input type="text" value={String(field.value)} onChange={(e) => field.onChange(e.target.value)} /></label>;
        default:
            return (
                <label>{field.title}<input type="text" value={String(field.value)} onChange={(e) => field.onChange(e.target.value)} /></label>
            );
    }
}
```

### 5. `packages/editor/src/react/index.ts` — sub-export barrel

```ts
export { ChartlangEditor, type ChartlangEditorProps } from "./ChartlangEditor";
export { InputsForm, type InputsFormProps } from "./inputs/InputsForm";
export { renderInputsForm, type InputsFormField, type InputsFormViewModel } from "./inputs/renderInputsForm";
```

### 6. Tests

- **`ChartlangEditor.test.tsx`** — render under
  `@testing-library/react` (add dev dep), assert the CM6 view
  mounts; `source` prop change re-syncs the doc;
  `targetCapabilities` change re-wires.
- **`renderInputsForm.test.ts`** — table-driven over every kind;
  cover `interval` source ← capabilities; cover `enum` source ←
  descriptor opts.
- **`renderInputsForm.property.test.ts`** — fast-check property:
  ViewModel round-trips value through `onChange` losslessly.
- **`InputsForm.test.tsx`** — render under
  `@testing-library/react`; per-kind fixture asserting the
  rendered control type + change emission.

### 7. JSDoc gate

Every export carries `@since 0.4` + compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/editor/package.json` | Modify | Add `/react` export, React peer/dev deps, and `@testing-library/react` dev dep |
| `packages/editor/tsconfig.json` | Modify | Build `/react` subpath |
| `packages/editor/src/react/ChartlangEditor.tsx` | Create | React wrapper |
| `packages/editor/src/react/inputs/renderInputsForm.ts` | Create | Headless ViewModel |
| `packages/editor/src/react/inputs/InputsForm.tsx` | Create | React form |
| `packages/editor/src/react/index.ts` | Create | Sub-export barrel |
| `packages/editor/src/react/ChartlangEditor.test.tsx` | Create | RTL tests |
| `packages/editor/src/react/inputs/renderInputsForm.test.ts` | Create | ViewModel tests |
| `packages/editor/src/react/inputs/renderInputsForm.property.test.ts` | Create | fast-check |
| `packages/editor/src/react/inputs/InputsForm.test.tsx` | Create | RTL tests |
| `packages/editor/vitest.config.ts` | Modify | TSX support + `happy-dom` |

## Edge Cases

- **React is an optional peer for consumers** — this workspace
  installs React as a dev dependency for tests, but published
  consumers who import `/react` must install React themselves.
- **`source` prop sync** is one-way: external changes overwrite
  the editor; internal edits emit `onSourceChange`. To avoid
  loops, the wrapper compares against the last known value
  before re-applying.
- **`onChange` immutability** — `renderInputsForm` returns a
  fresh frozen record on every change. Callers using React's
  `useState(initial)` pattern get the canonical update flow.
- **`interval` field without `capabilities`** falls back to a
  free-text input — degradation per §7.4. Test pins both paths.
- **`color` input** — native `<input type="color">` returns
  `#rrggbb`; same as the `Color = string` contract. No
  conversion needed.
- **Multiline string** — render `string` descriptors with
  `multiline: true` as `<textarea>` in this task. The ViewModel
  already carries the flag, so the React renderer must not leave
  this as a TODO.
- **Coverage** — `react/index.ts` barrel exempt; `*.tsx` files
  contribute to coverage just like `.ts`.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage on
  `@invinite-org/chartlang-editor` — both entries combined),
  `pnpm docs:check`, `pnpm readme:check`.

## Changeset

`.changeset/phase-4-task-15-editor-react-and-inputs-ui.md` —
**minor** on `@invinite-org/chartlang-editor`.

## Acceptance Criteria

- `import { ChartlangEditor, InputsForm, renderInputsForm } from
  "@invinite-org/chartlang-editor/react"` resolves.
- `<ChartlangEditor />` mounts a working CM6 editor in a React
  app.
- `<InputsForm />` renders one control per input descriptor.
- `interval` field sources options from `capabilities.intervals`.
- 100% coverage on the package.
- JSDoc + README gates green.
- Changeset committed.
