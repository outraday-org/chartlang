// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const INDENT_UNIT = "    ";

// The net bracket-depth change a line contributes, counting only the
// structural `{ [ (` / `} ] )` characters that sit outside string literals.
// Compute statements are pre-stringified source, so a line like
// `draw.line({ … }, { … });` nets zero and never shifts the running depth.
function depthDelta(line: string): { delta: number; leadingClose: number } {
    let delta = 0;
    let leadingClose = 0;
    let sawNonClose = false;
    let inString: '"' | "'" | "`" | null = null;
    let escaped = false;
    for (const ch of line) {
        if (inString !== null) {
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === inString) {
                inString = null;
            }
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            inString = ch;
            sawNonClose = true;
            continue;
        }
        if (ch === "{" || ch === "[" || ch === "(") {
            delta += 1;
            sawNonClose = true;
        } else if (ch === "}" || ch === "]" || ch === ")") {
            delta -= 1;
            if (!sawNonClose) {
                leadingClose += 1;
            }
        } else if (ch !== " " && ch !== "\t") {
            sawNonClose = true;
        }
    }
    return { delta, leadingClose };
}

/**
 * Re-indent a flat chartlang source string by structural bracket depth at 4
 * spaces per level, drop trailing whitespace from every line, collapse blank
 * lines that the section joiner introduced, and guarantee exactly one
 * trailing newline. The input lines are authored canonical (double quotes,
 * semicolons, trailing commas) so this is a deterministic normalize pass, not
 * a full reformat — it produces a string Biome accepts without a follow-up
 * `format` step. Lines opening with a closing bracket dedent before they
 * print so block tails align with their opener.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { formatSource } from "./format.js";
 *     formatSource("a {\nb;\n}\n"); // "a {\n    b;\n}\n"
 */
export function formatSource(raw: string): string {
    const out: string[] = [];
    let depth = 0;
    let previousBlank = false;
    for (const rawLine of raw.split("\n")) {
        const line = rawLine.trim();
        if (line === "") {
            if (!previousBlank && out.length > 0) {
                out.push("");
            }
            previousBlank = true;
            continue;
        }
        previousBlank = false;
        const { delta, leadingClose } = depthDelta(line);
        const printDepth = Math.max(0, depth - leadingClose);
        out.push(`${INDENT_UNIT.repeat(printDepth)}${line}`);
        depth = Math.max(0, depth + delta);
    }
    while (out.length > 0 && out[out.length - 1] === "") {
        out.pop();
    }
    return `${out.join("\n")}\n`;
}
