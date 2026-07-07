// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// A compact `− [px ▾] +` control for the workspace toolbar that adjusts the
// editor font size live. The range (11–22), presets (12/14/16/18/20), and the
// clamp helper come from `@invinite-org/chartlang-editor` so this UI shares one
// source of truth with the editor capability — no hardcoded bounds here.
//
// The selected size can fall between presets (via −/+), so the trigger renders
// the live `${fontSize} px` readout directly instead of a `<SelectValue>` (which
// only reflects a matching preset item).

import {
  clampEditorFontSize,
  EDITOR_FONT_SIZE_PRESETS,
  MAX_EDITOR_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
} from "@invinite-org/chartlang-editor"
import { Minus, Plus } from "lucide-react"
import { type ReactElement } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

export type FontSizeControlsProps = Readonly<{
  fontSize: number
  onChange: (next: number) => void
}>

/**
 * Editor font-size control. Every mutation routes through
 * `clampEditorFontSize`; the disabled −/+ states and the in-range preset list
 * are secondary guards against out-of-range values.
 */
export function FontSizeControls({ fontSize, onChange }: FontSizeControlsProps): ReactElement {
  return (
    <div className="flex h-7 items-center gap-0.5">
      <Button
        aria-label="Decrease font size"
        disabled={fontSize <= MIN_EDITOR_FONT_SIZE}
        onClick={() => onChange(clampEditorFontSize(fontSize - 1))}
        size="icon-sm"
        title="Decrease font size"
        type="button"
        variant="ghost"
      >
        <Minus />
      </Button>
      <Select
        onValueChange={(value) => onChange(clampEditorFontSize(Number(value)))}
        value={String(fontSize)}
      >
        <SelectTrigger aria-label="Font size" className="text-xs" size="sm" title="Font size">
          <span className="tabular-nums">{fontSize} px</span>
        </SelectTrigger>
        <SelectContent>
          {EDITOR_FONT_SIZE_PRESETS.map((preset) => (
            <SelectItem key={preset} value={String(preset)}>
              {preset} px
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        aria-label="Increase font size"
        disabled={fontSize >= MAX_EDITOR_FONT_SIZE}
        onClick={() => onChange(clampEditorFontSize(fontSize + 1))}
        size="icon-sm"
        title="Increase font size"
        type="button"
        variant="ghost"
      >
        <Plus />
      </Button>
    </div>
  )
}
