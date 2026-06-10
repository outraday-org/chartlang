// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Completion, CompletionContext } from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import type {
    ChartlangLanguageService,
    CompletionItem,
} from "@invinite-org/chartlang-language-service";

/**
 * Create a CM6 autocomplete extension backed by chartlang language-service
 * completions.
 *
 * @since 0.4
 * @stable
 * @example
 *     const extension = completionExtension(() => createLanguageService());
 *     void extension;
 */
export function completionExtension(getService: () => ChartlangLanguageService): Extension {
    return autocompletion({
        override: [
            (context: CompletionContext) => {
                const source = context.state.doc.toString();
                const options = getService().getCompletions(source, context.pos).map(toCompletion);
                if (options.length === 0) return null;
                const token = context.matchBefore(/[A-Za-z_$][\w$.\-"]*/);
                return {
                    from: completionStart(token, context.pos),
                    options,
                    validFor: /^[\w$.\-"]*$/,
                };
            },
        ],
    });
}

/**
 * Resolve the replacement start offset for a CM6 completion request.
 *
 * @since 0.4
 * @stable
 * @example
 *     const from = completionStart(null, 4);
 *     void from;
 */
export function completionStart(token: Readonly<{ from: number }> | null, pos: number): number {
    return token === null ? pos : token.from;
}

function toCompletion(item: CompletionItem): Completion {
    const completion: Completion = {
        label: item.label,
        apply: item.insertText,
    };
    const type = completionType(item.kind);
    if (type !== undefined) completion.type = type;
    if (item.detail !== undefined) completion.detail = item.detail;
    if (item.doc !== undefined) completion.info = `${item.doc.title}\n\n${item.doc.summary}`;
    return completion;
}

function completionType(kind: CompletionItem["kind"]): Completion["type"] {
    if (kind === "function") return "function";
    if (kind === "namespace") return "namespace";
    if (kind === "property") return "property";
    if (kind === "enumMember") return "enum";
    return "keyword";
}
