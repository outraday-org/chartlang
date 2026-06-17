// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `ConvertOpts` controls: a bar-interval (ms) field — needed when the Pine
// source uses future `bar_index + N` anchors — and a strict-mode toggle
// (upgrades every warning to an error in the result). Both feed straight
// into the `convert(...)` options via the parent's state.

import type { ChangeEvent, ReactElement } from "react";

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

    return (
        <div className="converter-controls">
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
