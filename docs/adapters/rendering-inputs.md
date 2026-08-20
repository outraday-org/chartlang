# Rendering inputs

`manifest.inputs` is the script's settings-panel contract. Each key is the
stable input name; each descriptor carries the default value, input kind, and
presentation metadata such as `group`, `inline`, `tooltip`, and `display`.

Use `groupInputs()` from `@invinite-org/chartlang-adapter-kit` before building
your settings UI:

```ts
import { groupInputs } from "@invinite-org/chartlang-adapter-kit";

for (const section of groupInputs(manifest.inputs)) {
    renderHeader(section.title ?? "");
    for (const row of section.rows) {
        renderRow(row.map((entry) => widgetFor(entry.name, entry.descriptor)));
    }
}
```

The helper returns sections in first group appearance order, rows in first
inline appearance order, and entries in declaration order within each row.
Inputs without `group` land in one `title: null` section. Inputs without
`inline` become their own single-entry row.

## Metadata

`descriptor.tooltip` is hover/help text for the control. Preserve it as plain
text; rich formatting is adapter-defined.

`descriptor.display` controls where the input value appears outside the
settings panel. Omitted means `"all"`. `"none"` means hide it from the status
line and data window, but still render the input in the settings panel.
`"status-line"` and `"data-window"` target only that auxiliary surface.

`Capabilities.inputs` is still the set of input kinds an adapter can render.
When an adapter advertises a kind, it should also honor that kind's metadata
through `groupInputs()`. There is no conformance scenario for `groupInputs()`
itself because it is a pure presentation helper, not a runtime emission
capability.

Undeclared kinds do not merely *fall back* — the runtime gates them. An input
whose kind is absent from `Capabilities.inputs` resolves to its manifest
default, any override the host passes for that key is ignored, and one
`unsupported-input-kind` diagnostic fires per key per mount (`external-series`
is exempt). So only build settings controls for the kinds the bag declares:
rendering a control for an undeclared kind produces a widget whose value the
runtime will drop. Widening the bag is the fix, not passing the override
anyway.

## Worked example

This example renders one group header and one inline row:

```ts
import { groupInputs } from "@invinite-org/chartlang-adapter-kit";
import type { InputSchema } from "@invinite-org/chartlang-core";

const inputs: InputSchema = {
    fast: {
        kind: "int",
        defaultValue: 9,
        title: "Fast",
        group: "Moving averages",
        inline: "lengths",
        tooltip: "Short moving average length.",
    },
    slow: {
        kind: "int",
        defaultValue: 21,
        title: "Slow",
        group: "Moving averages",
        inline: "lengths",
    },
};

const [section] = groupInputs(inputs);
renderHeader(section?.title ?? "");
renderRow(
    section?.rows[0]?.map((entry) => ({
        key: entry.name,
        label: entry.descriptor.title ?? entry.name,
        help: entry.descriptor.tooltip,
        hiddenFromStatus: entry.descriptor.display === "none",
    })) ?? [],
);
```
