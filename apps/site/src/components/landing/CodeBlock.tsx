// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type ReactElement, useEffect, useState } from "react"
import { codeToHtml } from "shiki"

export type CodeBlockProps = Readonly<{
  code: string
  lang?: "ts" | "tsx" | "bash" | "json"
  /** Visible filename above the block. */
  filename?: string
}>

/**
 * Shiki-highlighted code snippet rendered in the brand theme. The first
 * paint shows the raw code; Shiki swaps in the highlighted markup once it
 * resolves client-side. The Shiki background is forced transparent so the
 * block blends into the muted card rather than floating on Shiki's own
 * dark gray.
 */
export function CodeBlock(props: CodeBlockProps): ReactElement {
  const { code, lang = "ts", filename } = props
  const [html, setHtml] = useState<string>("")

  useEffect(() => {
    let active = true
    void codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark-dimmed" },
      defaultColor: false,
      transformers: [
        {
          pre(node) {
            node.properties.style = "background:transparent"
          },
        },
      ],
    }).then((result) => {
      if (active) setHtml(result)
    })
    return () => {
      active = false
    }
  }, [code, lang])

  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-muted/40">
      {filename ? (
        <figcaption className="border-b border-border px-4 py-2 font-mono text-xs text-muted-foreground">
          {filename}
        </figcaption>
      ) : null}
      {html ? (
        <div
          className="overflow-x-auto p-4 text-sm leading-relaxed [&_pre]:m-0"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is pre-escaped HTML
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
          <code>{code}</code>
        </pre>
      )}
    </figure>
  )
}
