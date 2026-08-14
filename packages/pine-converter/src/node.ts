// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile, writeFile } from "node:fs/promises";

import { convert } from "./index.js";
import type { ConvertOpts, ConvertResult } from "./index.js";

/**
 * Caller-supplied options for {@link convertFile}. Extends `ConvertOpts`
 * with an optional `outPath`; when set and the conversion produces a non-null
 * `output`, the converted `.chart.ts` source is written there.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: ConvertFileOpts = { outPath: "out/hello.chart.ts", strictMode: true };
 *     void opts;
 */
export type ConvertFileOpts = ConvertOpts & Readonly<{ outPath?: string }>;

/**
 * Async file-system wrapper around `convert`: reads `path` as UTF-8,
 * converts it, and — when `opts.outPath` is set AND the conversion yields a
 * non-null `output` — writes that output to `opts.outPath`. Returns the same
 * `ConvertResult` as `convert`. File I/O failures (missing input, permission
 * denied) REJECT the promise: they are host-environment errors, NOT converter
 * diagnostics, and must be distinguishable from a clean conversion that merely
 * emitted error-severity diagnostics.
 *
 * This lives on the `/node` sub-export, not the package root: it is the only
 * API in the package that touches `node:*`, and the root entry is kept free of
 * `node:` specifiers so it resolves in browsers, Deno and workers.
 *
 * @since 0.1
 * @stable
 * @example
 *     const result = await convertFile("hello.pine", { outPath: "hello.chart.ts" });
 *     result.output !== null; // true when the conversion succeeded
 */
export async function convertFile(path: string, opts?: ConvertFileOpts): Promise<ConvertResult> {
    const source = await readFile(path, "utf-8");
    const convertOpts = stripOutPath(opts);
    const result = convertOpts === undefined ? convert(source) : convert(source, convertOpts);
    if (opts?.outPath !== undefined && result.output !== null) {
        await writeFile(opts.outPath, result.output, "utf-8");
    }
    return result;
}

// Project a `ConvertFileOpts` down to the `ConvertOpts` `convert` accepts by
// dropping the `outPath` field. Returns `undefined` when no convert-relevant
// option survives so the caller forwards nothing (preserving the
// `exactOptionalPropertyTypes` contract — no explicit `undefined` fields).
function stripOutPath(opts: ConvertFileOpts | undefined): ConvertOpts | undefined {
    if (opts === undefined) {
        return undefined;
    }
    const { outPath: _outPath, ...rest } = opts;
    return rest;
}
