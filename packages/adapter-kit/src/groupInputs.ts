// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { InputDescriptor, InputSchema } from "@invinite-org/chartlang-core";

/**
 * One named input descriptor ready for adapter UI rendering.
 *
 * @since 1.8
 * @stable
 * @example
 *     import type { GroupedInputEntry } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const entry: GroupedInputEntry = {
 *         name: "length",
 *         descriptor: { kind: "int", defaultValue: 20 },
 *     };
 *     void entry;
 */
export type GroupedInputEntry = Readonly<{
    name: string;
    descriptor: InputDescriptor<unknown>;
}>;

/**
 * One settings-panel row. Entries sharing the same non-null `inline`
 * metadata within a group appear in the same row, in declaration order.
 *
 * @since 1.8
 * @stable
 * @example
 *     import type { GroupedInputRow } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const row: GroupedInputRow = [
 *         { name: "fast", descriptor: { kind: "int", defaultValue: 9 } },
 *         { name: "slow", descriptor: { kind: "int", defaultValue: 21 } },
 *     ];
 *     void row;
 */
export type GroupedInputRow = readonly GroupedInputEntry[];

/**
 * One input section. `title` is the descriptor `group` string, or `null`
 * for inputs declared without a group.
 *
 * @since 1.8
 * @stable
 * @example
 *     import type { GroupedInputSection } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const section: GroupedInputSection = {
 *         title: "Trend",
 *         rows: [[{ name: "length", descriptor: { kind: "int", defaultValue: 20 } }]],
 *     };
 *     void section;
 */
export type GroupedInputSection = Readonly<{
    title: string | null;
    rows: readonly GroupedInputRow[];
}>;

type MutableInputSection = {
    readonly title: string | null;
    readonly rows: GroupedInputEntry[][];
    lastInline: string | undefined;
};

function inputGroup(descriptor: InputDescriptor<unknown>): string | null {
    if ("group" in descriptor && typeof descriptor.group === "string") return descriptor.group;
    return null;
}

function inputInline(descriptor: InputDescriptor<unknown>): string | undefined {
    if ("inline" in descriptor && typeof descriptor.inline === "string") return descriptor.inline;
    return undefined;
}

function getOrCreateSection(
    sections: Map<string | null, MutableInputSection>,
    title: string | null,
): MutableInputSection {
    const existing = sections.get(title);
    if (existing !== undefined) return existing;
    const created = { title, rows: [], lastInline: undefined };
    sections.set(title, created);
    return created;
}

/**
 * Group a manifest input schema into ordered settings-panel sections and
 * rows. Group order, row order, and row entry order all follow first
 * appearance in `manifest.inputs`.
 *
 * @since 1.8
 * @stable
 * @example
 *     import { groupInputs } from "@invinite-org/chartlang-adapter-kit";
 *     import type { InputSchema } from "@invinite-org/chartlang-core";
 *
 *     const inputs: InputSchema = {
 *         fast: { kind: "int", defaultValue: 9, group: "MA", inline: "len" },
 *         slow: { kind: "int", defaultValue: 21, group: "MA", inline: "len" },
 *     };
 *
 *     for (const section of groupInputs(inputs)) {
 *         void section.title;
 *         for (const row of section.rows) void row.map((entry) => entry.name);
 *     }
 */
export function groupInputs(inputs: InputSchema): readonly GroupedInputSection[] {
    const sections = new Map<string | null, MutableInputSection>();

    for (const [name, descriptor] of Object.entries(inputs)) {
        const section = getOrCreateSection(sections, inputGroup(descriptor));
        const entry = { name, descriptor };
        const inline = inputInline(descriptor);
        if (inline === undefined) {
            section.rows.push([entry]);
            section.lastInline = undefined;
        } else {
            const previousRow = section.rows.at(-1);
            if (section.lastInline === inline && previousRow !== undefined) {
                previousRow.push(entry);
                continue;
            }
            section.rows.push([entry]);
            section.lastInline = inline;
        }
    }

    return Array.from(sections.values(), ({ title, rows }) => ({ title, rows }));
}
