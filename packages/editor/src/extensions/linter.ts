// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic } from "@codemirror/lint";
import { lintGutter, linter } from "@codemirror/lint";
import type { Extension, Text } from "@codemirror/state";
import type { CompiledScriptObject } from "@invinite-org/chartlang-core";
import type {
    createLanguageService,
    LspDiagnostic,
    LspSeverity,
} from "@invinite-org/chartlang-language-service";

type LanguageService = ReturnType<typeof createLanguageService>;

/**
 * Create a CM6 linter extension backed by chartlang compiler diagnostics.
 *
 * @since 0.4
 * @stable
 * @example
 *     const extension = linterExtension(() => createLanguageService());
 *     void extension;
 */
export function linterExtension(
    getService: () => LanguageService,
    onCompiled?: (compiled: CompiledScriptObject) => void,
    debounceMs = 250,
): Extension {
    void onCompiled;
    return [
        lintGutter(),
        linter(
            async (view) => {
                const diagnostics = await getService().compileToDiagnostics(
                    view.state.doc.toString(),
                );
                return diagnostics.map((diagnostic) => toCmDiagnostic(view.state.doc, diagnostic));
            },
            { delay: debounceMs },
        ),
    ];
}

function toCmDiagnostic(doc: Text, diagnostic: LspDiagnostic): Diagnostic {
    const line = doc.line(Math.max(1, diagnostic.range.startLine));
    const from = Math.min(line.to, line.from + Math.max(0, diagnostic.range.startColumn - 1));
    const endLine = doc.line(Math.max(1, diagnostic.range.endLine));
    const to = Math.max(
        from + 1,
        Math.min(endLine.to, endLine.from + Math.max(0, diagnostic.range.endColumn - 1)),
    );
    return {
        from,
        to,
        severity: toCmSeverity(diagnostic.severity),
        message: diagnostic.message,
        source: diagnostic.code,
    };
}

function toCmSeverity(severity: LspSeverity): Diagnostic["severity"] {
    if (severity === "error") return "error";
    if (severity === "warning") return "warning";
    return "info";
}
