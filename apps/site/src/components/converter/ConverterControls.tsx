// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `ConvertOpts` controls: a bar-interval (ms) field — needed when the Pine
// source uses future `bar_index + N` anchors — and a strict-mode toggle
// (upgrades every warning to an error in the result). Both feed straight
// into the `convert(...)` options via the parent's state.

import type { ChangeEvent, ReactElement } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Common chart timeframes mapped to their millisecond duration. Selecting one
 * fills the bar-interval (ms) field; arbitrary values stay editable in the
 * number input ("Custom").
 */
const BAR_INTERVAL_PRESETS: ReadonlyArray<Readonly<{ label: string; ms: number }>> = [
    { label: "1 minute", ms: MINUTE_MS },
    { label: "3 minutes", ms: 3 * MINUTE_MS },
    { label: "5 minutes", ms: 5 * MINUTE_MS },
    { label: "15 minutes", ms: 15 * MINUTE_MS },
    { label: "30 minutes", ms: 30 * MINUTE_MS },
    { label: "1 hour", ms: HOUR_MS },
    { label: "2 hours", ms: 2 * HOUR_MS },
    { label: "4 hours", ms: 4 * HOUR_MS },
    { label: "1 day", ms: DAY_MS },
    { label: "1 week", ms: 7 * DAY_MS },
    { label: "1 month", ms: 30 * DAY_MS },
];

/** Props for {@link ConverterControls}. */
export type ConverterControlsProps = Readonly<{
    barInterval: number | null;
    strictMode: boolean;
    onBarIntervalChange: (next: number | null) => void;
    onStrictModeChange: (next: boolean) => void;
}>;

/**
 * Renders the converter option controls. An empty bar-interval field maps
 * to `null` (the converter default); any finite number is forwarded as-is.
 */
export function ConverterControls(props: ConverterControlsProps): ReactElement {
    const handleBarInterval = (event: ChangeEvent<HTMLInputElement>): void => {
        const raw = event.target.value.trim();
        if (raw === "") {
            props.onBarIntervalChange(null);
            return;
        }
        const parsed = Number(raw);
        props.onBarIntervalChange(Number.isFinite(parsed) ? parsed : null);
    };

    const handlePreset = (value: string | null): void => {
        props.onBarIntervalChange(value === null || value === "" ? null : Number(value));
    };

    // Reflect the current ms value back to the dropdown: a matching preset, or
    // "" (auto) when null, or "custom" for any value with no preset.
    const presetValue =
        props.barInterval === null
            ? ""
            : (BAR_INTERVAL_PRESETS.find((preset) => preset.ms === props.barInterval)?.ms.toString() ?? "custom");

    return (
        <div className="converter-controls">
            <label>
                <span>Period</span>
                <Select
                    items={[
                        { label: "auto", value: "" },
                        ...BAR_INTERVAL_PRESETS.map((preset) => ({ label: preset.label, value: preset.ms.toString() })),
                        ...(presetValue === "custom" ? [{ label: "Custom", value: "custom" }] : []),
                    ]}
                    onValueChange={handlePreset}
                    value={presetValue}
                >
                    <SelectTrigger className="w-[160px]" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">auto</SelectItem>
                        {BAR_INTERVAL_PRESETS.map((preset) => (
                            <SelectItem key={preset.ms} value={preset.ms.toString()}>
                                {preset.label}
                            </SelectItem>
                        ))}
                        {presetValue === "custom" ? <SelectItem value="custom">Custom</SelectItem> : null}
                    </SelectContent>
                </Select>
            </label>
            <label>
                <span>Bar interval (ms)</span>
                <input
                    min={0}
                    onChange={handleBarInterval}
                    placeholder="auto"
                    type="number"
                    value={props.barInterval ?? ""}
                />
            </label>
            <label>
                <input
                    checked={props.strictMode}
                    onChange={(event) => props.onStrictModeChange(event.target.checked)}
                    type="checkbox"
                />
                <span>Strict mode</span>
            </label>
        </div>
    );
}
