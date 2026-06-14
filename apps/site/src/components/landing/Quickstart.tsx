// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type ReactElement, useState } from "react"

import { CodeBlock } from "@/components/landing/CodeBlock"

const DOCS_URL = "https://docs.chartlang.invinite.com"

type Role = Readonly<{
  id: string
  label: string
  install: string
  installFilename: string
  snippet: string
  snippetLang: "ts" | "bash"
  snippetFilename: string
}>

const SCRIPT_AUTHOR_ROLE: Role = {
  id: "script-author",
  label: "Script author",
  install: "pnpm add @invinite-org/chartlang-core",
  installFilename: "install",
  snippetLang: "ts",
  snippetFilename: "ema-cross.chart.ts",
  snippet: `import { defineIndicator } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "EMA Cross",
  apiVersion: 1,
  overlay: true,
  compute({ bar, ta, plot }) {
    plot(ta.ema(bar.close, 12), { color: "#26a69a" })
    plot(ta.ema(bar.close, 26), { color: "#ef5350" })
  },
})
`,
}

const ROLES: readonly Role[] = [
  SCRIPT_AUTHOR_ROLE,
  {
    id: "adapter-author",
    label: "Adapter author",
    install: "pnpm add @invinite-org/chartlang-adapter-kit",
    installFilename: "install",
    snippetLang: "ts",
    snippetFilename: "adapter.ts",
    snippet: `import { defineAdapter } from "@invinite-org/chartlang-adapter-kit"

export const adapter = defineAdapter({
  capabilities: { plot: true },
  plotLine(series, options) {
    // draw series on your chart surface
  },
})
`,
  },
  {
    id: "embedder",
    label: "Embedder",
    install:
      "pnpm add @invinite-org/chartlang-core @invinite-org/chartlang-compiler @invinite-org/chartlang-runtime @invinite-org/chartlang-host-worker",
    installFilename: "install",
    snippetLang: "ts",
    snippetFilename: "embed.ts",
    snippet: `import { createScriptRunner } from "@invinite-org/chartlang-host-worker"

const runner = await createScriptRunner({ bundle, adapter })
`,
  },
]

/**
 * Role-tabbed quickstart mirroring the root README's install matrix: one
 * install line and one minimal snippet per role (script author, adapter
 * author, embedder), driven by a self-contained tab switcher.
 */
export function Quickstart(): ReactElement {
  const [activeId, setActiveId] = useState<string>(SCRIPT_AUTHOR_ROLE.id)
  const active = ROLES.find((role) => role.id === activeId) ?? SCRIPT_AUTHOR_ROLE

  return (
    <section id="quickstart" className="py-20 md:py-28">
      <h2 className="text-3xl font-bold text-foreground md:text-4xl">Quickstart</h2>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Three roles, one install line each. Pick yours, then write your first
        script, build an adapter, or embed the runtime.
      </p>

      <div className="mt-10 max-w-2xl">
        <div role="tablist" aria-label="Install by role" className="flex flex-wrap gap-2">
          {ROLES.map((role) => {
            const selected = role.id === active.id
            return (
              <button
                key={role.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${role.id}`}
                id={`tab-${role.id}`}
                onClick={() => setActiveId(role.id)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {role.label}
              </button>
            )
          })}
        </div>

        <div
          id={`panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          className="mt-6 space-y-4"
        >
          <CodeBlock code={active.install} lang="bash" filename={active.installFilename} />
          <CodeBlock
            code={active.snippet}
            lang={active.snippetLang}
            filename={active.snippetFilename}
          />
        </div>
      </div>

      <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
        See the{" "}
        <a href={DOCS_URL} className="text-foreground underline underline-offset-4">
          docs
        </a>{" "}
        for the complete API reference and a step-by-step{" "}
        <a
          href={`${DOCS_URL}/getting-started/write-your-first-script`}
          className="text-foreground underline underline-offset-4"
        >
          Getting started guide
        </a>
        .
      </p>
    </section>
  )
}
