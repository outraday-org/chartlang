// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// "Browse examples" dialog for the Pine converter playground. A trigger
// button opens a centered shadcn `Dialog` (Base UI) with a left sidebar of
// categories (CATEGORY_ORDER, non-empty only, with counts) and a right pane
// listing that category's samples (label + description). The inner layout
// reuses the demo's `.example-browser*` styles (in `demo/demo.css`, already
// imported by `ConverterBody`); since the dialog portals to <body>, the
// content carries the `cl-demo` class so those `.cl-demo …`-scoped rules
// still resolve.

import { type ReactElement, useMemo, useState } from "react";

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    type PineCategory,
    type PineScript,
} from "./pineScripts";

type PineExampleBrowserProps = Readonly<{
    scripts: ReadonlyArray<PineScript>;
    activeId: string;
    onSelect: (id: string) => void;
}>;

/**
 * The categorized Pine-sample picker. The trigger shows the active sample's
 * label and the total count (e.g. "MACD · 39 examples"). Opening the dialog
 * re-derives `activeCategory` from the active sample so a `?script=`
 * deep-link pre-highlights the right category.
 */
export function PineExampleBrowser(props: PineExampleBrowserProps): ReactElement {
    const { scripts, activeId, onSelect } = props;
    const [open, setOpen] = useState(false);

    const activeScript = scripts.find((s) => s.id === activeId) ?? scripts[0];
    const fallbackCategory: PineCategory = activeScript?.category ?? CATEGORY_ORDER[0];
    const [activeCategory, setActiveCategory] = useState<PineCategory>(fallbackCategory);

    // Non-empty categories in CATEGORY_ORDER with the count the sidebar
    // shows. Recomputed only when the sample list changes.
    const categories = useMemo(
        () =>
            CATEGORY_ORDER.map((category) => ({
                category,
                count: scripts.filter((s) => s.category === category).length,
            })).filter((entry) => entry.count > 0),
        [scripts],
    );

    const visibleExamples = scripts.filter((s) => s.category === activeCategory);

    const handleOpenChange = (next: boolean): void => {
        // Re-derive from the live active sample (covers deep-links + prior
        // selections) so the dialog always opens on the active category.
        if (next) setActiveCategory(fallbackCategory);
        setOpen(next);
    };

    const pick = (id: string): void => {
        onSelect(id);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger aria-label="Browse examples" className="example-browser-trigger">
                <span className="example-browser-trigger-label">{activeScript?.label ?? "Examples"}</span>
                <span className="example-browser-trigger-count">· {scripts.length} examples</span>
            </DialogTrigger>

            <DialogContent
                aria-label="Browse examples"
                className="cl-demo w-[min(820px,92vw)] max-w-[92vw] gap-0 overflow-hidden p-0"
                showCloseButton={false}
            >
                <div className="example-browser">
                    <header className="example-browser-header">
                        <DialogTitle className="example-browser-title">Browse examples</DialogTitle>
                        <DialogClose aria-label="Close" className="example-browser-close">
                            ✕
                        </DialogClose>
                    </header>
                    <div className="example-browser-body">
                        <nav aria-label="Categories" className="example-browser-categories">
                            {categories.map(({ category, count }) => (
                                <button
                                    aria-current={category === activeCategory ? "true" : undefined}
                                    className="example-browser-category"
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    type="button"
                                >
                                    <span className="example-browser-category-label">
                                        {CATEGORY_LABELS[category]}
                                    </span>
                                    <span className="example-browser-category-count">{count}</span>
                                </button>
                            ))}
                        </nav>
                        <ul className="example-browser-list">
                            {visibleExamples.map((script) => (
                                <li key={script.id}>
                                    <button
                                        aria-current={script.id === activeId ? "true" : undefined}
                                        className="example-browser-item"
                                        onClick={() => pick(script.id)}
                                        type="button"
                                    >
                                        <span className="example-browser-item-label">{script.label}</span>
                                        <span className="example-browser-item-desc">{script.description}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
