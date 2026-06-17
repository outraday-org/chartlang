// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Debounced client-side conversion hook. `convert` is a pure synchronous
// function (no Node APIs reach it — only the separate `convertFile` touches
// the filesystem), so the whole Pine → chartlang pass runs in the browser
// with no server round-trip. The first result is computed eagerly so the
// output pane is populated on mount; subsequent edits debounce.

import { type ConvertResult, convert } from "@invinite-org/chartlang-pine-converter";
import { useEffect, useState } from "react";

const DEBOUNCE_MS = 150;

/** Conversion options surfaced by the playground controls. */
export type ConverterOptions = Readonly<{
    barInterval: number | null;
    strictMode: boolean;
}>;

function runConvert(source: string, options: ConverterOptions): ConvertResult {
    return convert(source, {
        barInterval: options.barInterval,
        strictMode: options.strictMode,
    });
}

/**
 * Run {@link convert} against `source` (debounced ~150ms) whenever the
 * source or options change, returning the latest `ConvertResult`. The
 * initial value is computed synchronously so the output is never empty
 * on first paint.
 */
export function useConverter(source: string, options: ConverterOptions): ConvertResult {
    const [result, setResult] = useState<ConvertResult>(() => runConvert(source, options));

    useEffect(() => {
        const handle = setTimeout(() => {
            setResult(runConvert(source, options));
        }, DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [source, options.barInterval, options.strictMode]);

    return result;
}
