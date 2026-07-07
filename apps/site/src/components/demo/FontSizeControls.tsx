// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    clampEditorFontSize,
    EDITOR_FONT_SIZE_PRESETS,
    MAX_EDITOR_FONT_SIZE,
    MIN_EDITOR_FONT_SIZE,
} from "@invinite-org/chartlang-editor";
import { Minus, Plus } from "lucide-react";
import { type ReactElement } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

/**
 * Props for {@link FontSizeControls}. `fontSize` is the controlled px value
 * (owned by {@link DemoBody}); `onChange` receives the next value — already
 * clamped to the package's `MIN`/`MAX` range.
 */
export type FontSizeControlsProps = Readonly<{
    fontSize: number;
    onChange: (next: number) => void;
}>;

/**
 * `−  [14 px ▾]  +` font-size control for the demo editor pane. The range,
 * presets, and clamp all come from `@invinite-org/chartlang-editor`, so the
 * demo shares the single 11–22 source of truth with every other chartlang
 * editor. Rendered by {@link DemoBody} as an absolutely-positioned overlay
 * inside the editor pane (the demo has no editor toolbar). No i18n — the demo
 * ships plain English strings.
 */
export function FontSizeControls(props: FontSizeControlsProps): ReactElement {
    const { fontSize, onChange } = props;

    const applyFontSize = (next: number): void => {
        onChange(clampEditorFontSize(next));
    };

    const handlePresetChange = (value: string | null): void => {
        if (value === null) return;
        const next = Number(value);
        if (!Number.isFinite(next)) return;
        applyFontSize(next);
    };

    return (
        <div className="font-size-controls">
            <button
                aria-label="Decrease font size"
                className="font-size-step"
                disabled={fontSize <= MIN_EDITOR_FONT_SIZE}
                onClick={() => applyFontSize(fontSize - 1)}
                title="Decrease font size"
                type="button"
            >
                <Minus size={14} />
            </button>
            <Select
                items={EDITOR_FONT_SIZE_PRESETS.map((size) => ({
                    label: `${size} px`,
                    value: String(size),
                }))}
                onValueChange={handlePresetChange}
                value={String(fontSize)}
            >
                {/* Render the live value directly (not `<SelectValue />`) so a
                    non-preset −/+ step (e.g. 13 px) still shows a correct
                    trigger label. */}
                <SelectTrigger aria-label="Font size" className="font-size-select" size="sm">
                    <span>{`${fontSize} px`}</span>
                </SelectTrigger>
                <SelectContent>
                    {EDITOR_FONT_SIZE_PRESETS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                            {`${size} px`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <button
                aria-label="Increase font size"
                className="font-size-step"
                disabled={fontSize >= MAX_EDITOR_FONT_SIZE}
                onClick={() => applyFontSize(fontSize + 1)}
                title="Increase font size"
                type="button"
            >
                <Plus size={14} />
            </button>
        </div>
    );
}
