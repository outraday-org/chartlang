// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// "Browse examples" dialog for the live demo. Replaces the flat
// `<select>` script switcher: a trigger button opens a modal with a left
// sidebar of categories (CATEGORY_ORDER, non-empty only, with counts) and
// a right pane listing that category's examples (label + description).
// Built on the native `<dialog>` element so focus-trap, `Esc`-to-close,
// and keyboard navigation come for free without a new dependency — there
// is no shared dialog primitive under `src/components/ui/`.

import { type ReactElement, useMemo, useRef, useState } from "react"

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type DemoScript,
  type ExampleCategory,
} from "./scripts"

type ExampleBrowserProps = Readonly<{
  scripts: ReadonlyArray<DemoScript>
  activeId: string
  onSelect: (id: string) => void
}>

/**
 * The categorized example picker. The trigger shows the active example's
 * label and the total count (e.g. "EMA Cross · 32 examples") with a
 * stable `aria-label` so its accessible name does not change per
 * selection. Opening the dialog re-derives `activeCategory` from the
 * active script so a `?script=` deep-link pre-highlights the right
 * category.
 */
export function ExampleBrowser(props: ExampleBrowserProps): ReactElement {
  const { scripts, activeId, onSelect } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  const activeScript = scripts.find((s) => s.id === activeId) ?? scripts[0]
  const fallbackCategory: ExampleCategory = activeScript?.category ?? CATEGORY_ORDER[0]
  const [activeCategory, setActiveCategory] = useState<ExampleCategory>(fallbackCategory)

  // Non-empty categories in CATEGORY_ORDER (complex sorts first) with the
  // count the sidebar shows. Recomputed only when the catalogue changes.
  const categories = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        count: scripts.filter((s) => s.category === category).length,
      })).filter((entry) => entry.count > 0),
    [scripts],
  )

  const visibleExamples = scripts.filter((s) => s.category === activeCategory)

  const openDialog = (): void => {
    // Re-derive from the live active script (covers deep-links + prior
    // selections) so the dialog always opens on the active category.
    setActiveCategory(fallbackCategory)
    setOpen(true)
    dialogRef.current?.showModal()
  }

  const closeDialog = (): void => {
    setOpen(false)
    dialogRef.current?.close()
  }

  const pick = (id: string): void => {
    onSelect(id)
    closeDialog()
  }

  return (
    <>
      <button
        aria-label="Browse examples"
        className="example-browser-trigger"
        onClick={openDialog}
        type="button"
      >
        <span className="example-browser-trigger-label">{activeScript?.label ?? "Examples"}</span>
        <span className="example-browser-trigger-count">· {scripts.length} examples</span>
      </button>

      <dialog
        aria-label="Browse examples"
        className="example-browser-dialog"
        // Native `<dialog>` fires `close` on Esc / `.close()`; keep React
        // state in sync so a re-open re-runs `openDialog`.
        onClose={() => setOpen(false)}
        // Close on a backdrop click (a click whose target is the dialog
        // element itself, i.e. outside the content panel).
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog()
        }}
        ref={dialogRef}
      >
        {open ? (
          <div className="example-browser">
            <header className="example-browser-header">
              <h2 className="example-browser-title">Browse examples</h2>
              <button
                aria-label="Close"
                className="example-browser-close"
                onClick={closeDialog}
                type="button"
              >
                ✕
              </button>
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
        ) : null}
      </dialog>
    </>
  )
}
