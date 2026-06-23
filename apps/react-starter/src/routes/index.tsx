// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// The chartlang workspace page. Wires together every prior task:
//   editor (Task 6) ─compile→ /api/compile (Task 2) ─artifact→ ChartPane (Task 5)
//   SymbolPicker ─loadSymbol→ /api/eod (Task 4) ─bars→ ChartPane
//   ScriptsSidebar ─CRUD→ /api/scripts (Task 3)
//
// Two flows are kept independent: editing updates `artifact` (re-compile only),
// picking a symbol updates `bars` (the only EOD fetch). The last good artifact
// is retained on a failing compile so the chart never blanks. No concrete chart
// adapter is named here — ChartPane drives the swappable `activeAdapter` seam.

import type { Bar } from "@invinite-org/chartlang-core"
import type { LspDiagnostic } from "@invinite-org/chartlang-language-service"
import { createFileRoute } from "@tanstack/react-router"
import { BellIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { ChartPane } from "@/components/workspace/ChartPane"
import { EditorPane } from "@/components/workspace/EditorPane"
import {
  type CompiledArtifact,
  type CompileStatus,
  createHybridLanguageService,
} from "@/components/workspace/hybridLanguageService"
import { ScriptsSidebar } from "@/components/workspace/ScriptsSidebar"
import { SymbolPicker } from "@/components/workspace/SymbolPicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { loadSymbol } from "@/lib/eodClient"
import { getScript, listScripts, saveScript } from "@/lib/scriptsClient"

// Client-side mirror of the server cap (src/lib/server/constants.ts, the SSOT)
// so save is blocked with a friendly message before the round-trip (the server
// 400s anyway). A component must not import the server module, hence the copy.
const MAX_SOURCE_BYTES = 64 * 1024

export const Route = createFileRoute("/")({ component: Workspace })

function statusLabel(status: CompileStatus): { text: string; tone: "ok" | "warn" | "error" | "muted" } {
  switch (status.kind) {
    case "idle":
      return { text: "Ready", tone: "muted" }
    case "compiling":
      return { text: "Compiling…", tone: "muted" }
    case "ok":
      return status.warningCount > 0
        ? { text: `OK · ${status.warningCount} warning(s)`, tone: "warn" }
        : { text: "OK", tone: "ok" }
    case "error":
      return {
        text: `${status.errorCount} error(s)${status.warningCount > 0 ? ` · ${status.warningCount} warning(s)` : ""}`,
        tone: "error",
      }
    case "transport-error":
      return { text: `Compile unavailable: ${status.message}`, tone: "error" }
  }
}

/** Tailwind text colour per status tone. */
const STATUS_TONE_CLASS: Record<ReturnType<typeof statusLabel>["tone"], string> = {
  ok: "text-foreground",
  warn: "text-foreground",
  error: "text-destructive",
  muted: "text-muted-foreground",
}

function Workspace(): ReactElement {
  // The editor follows the app's light/dark mode. `resolvedTheme` collapses
  // "system" to the concrete theme; it is undefined until next-themes mounts,
  // so default to light. Folded into the editor `key` below so a toggle
  // remounts the editor with the matching CodeMirror theme.
  const { resolvedTheme } = useTheme()
  const editorTheme: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light"

  const [source, setSource] = useState("")
  const [loadedSource, setLoadedSource] = useState("")
  const [symbol, setSymbol] = useState<string | null>(null)
  const [bars, setBars] = useState<ReadonlyArray<Bar>>([])
  const [artifact, setArtifact] = useState<CompiledArtifact | null>(null)
  const [status, setStatus] = useState<CompileStatus>({ kind: "idle" })
  const [, setDiagnostics] = useState<ReadonlyArray<LspDiagnostic>>([])
  const [currentScriptId, setCurrentScriptId] = useState<string | null>(null)
  const [currentName, setCurrentName] = useState("")
  const [alertCount, setAlertCount] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [editorKey, setEditorKey] = useState(0)
  const [pendingLoadId, setPendingLoadId] = useState<string | null>(null)

  // Latest-source ref so async callbacks (save) read the current buffer
  // without re-creating handlers on every keystroke.
  const sourceRef = useRef(source)
  sourceRef.current = source
  const symbolRef = useRef(symbol)
  symbolRef.current = symbol

  // The hybrid service is created ONCE for the page lifetime. Its observer is
  // the single side-channel from a compile to the chart: artifact is forwarded
  // only when non-null, so a failing compile retains the last good chart.
  const service = useMemo(
    () =>
      createHybridLanguageService((nextStatus, nextArtifact, nextDiagnostics) => {
        setStatus(nextStatus)
        setDiagnostics(nextDiagnostics)
        if (nextArtifact !== null) {
          setArtifact(nextArtifact)
          setAlertCount(0)
        }
      }),
    [],
  )

  const dirty = source !== loadedSource

  // Load a symbol's daily bars (the only EOD fetch). A first load fetches from
  // Yahoo + caches; later loads serve from the SQLite cache. A failure toasts.
  const pickSymbol = (next: string): void => {
    void (async (): Promise<void> => {
      try {
        const result = await loadSymbol(next)
        setBars(result.bars)
        setSymbol(next)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load symbol")
      }
    })()
  }

  // Apply a loaded script to the editor + chart. Re-mounts the editor (via
  // editorKey) so `initialSource` takes effect, and loads the script's symbol
  // when it has one (else clears the chart's bars).
  const applyScript = (script: { id: string; name: string; source: string; symbol: string | null }): void => {
    setSource(script.source)
    setLoadedSource(script.source)
    setCurrentScriptId(script.id)
    setCurrentName(script.name)
    setEditorKey((k) => k + 1)
    setArtifact(null)
    setAlertCount(0)
    if (script.symbol !== null && script.symbol !== "") {
      pickSymbol(script.symbol)
    } else {
      setSymbol(null)
      setBars([])
    }
  }

  // Boot: load the seed (or first) saved script + its symbol.
  useEffect(() => {
    let cancelled = false
    void (async (): Promise<void> => {
      try {
        const metas = await listScripts()
        const first = metas[0]
        if (cancelled || first === undefined) return
        const full = await getScript(first.id)
        if (cancelled || full === null) return
        applyScript({ id: full.id, name: full.name, source: full.source, symbol: full.symbol })
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load scripts")
      }
    })()
    return () => {
      cancelled = true
    }
    // Run once on mount; applyScript/listScripts are stable for the page life.
  }, [])

  const doLoad = (id: string): void => {
    void (async (): Promise<void> => {
      try {
        const full = await getScript(id)
        if (full === null) {
          toast.error("Script no longer exists")
          return
        }
        applyScript({ id: full.id, name: full.name, source: full.source, symbol: full.symbol })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load script")
      }
    })()
  }

  // Dirty-guard: confirm before discarding unsaved edits on load.
  const requestLoad = (id: string): void => {
    if (id === currentScriptId) return
    if (dirty) {
      setPendingLoadId(id)
      return
    }
    doLoad(id)
  }

  const handleNew = (): void => {
    const blank = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
  name: "New script",
  apiVersion: 1,
  overlay: true,
  compute({ bar, plot }) {
    plot(bar.close, { title: "Close" });
  },
});
`
    setSource(blank)
    setLoadedSource("")
    setCurrentScriptId(null)
    setCurrentName("")
    setEditorKey((k) => k + 1)
    setArtifact(null)
    setAlertCount(0)
  }

  const handleSave = (name: string): void => {
    const current = sourceRef.current
    if (new Blob([current]).size > MAX_SOURCE_BYTES) {
      toast.error("Script is too large to save (over 64 KiB).")
      return
    }
    void (async (): Promise<void> => {
      try {
        const saved = await saveScript({
          ...(currentScriptId !== null ? { id: currentScriptId } : {}),
          name,
          source: current,
          symbol: symbolRef.current,
        })
        setCurrentScriptId(saved.id)
        setCurrentName(saved.name)
        setLoadedSource(saved.source)
        setReloadKey((n) => n + 1)
        toast.success(`Saved “${saved.name}”`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      }
    })()
  }

  const label = statusLabel(status)
  const statusTone = STATUS_TONE_CLASS[label.tone]

  return (
    <ResizablePanelGroup className="h-full" direction="horizontal">
      <ResizablePanel collapsible defaultSize={18} maxSize={32} minSize={12}>
        <ScriptsSidebar
          currentName={currentName}
          currentScriptId={currentScriptId}
          dirty={dirty}
          onLoad={requestLoad}
          onNew={handleNew}
          onSave={handleSave}
          reloadKey={reloadKey}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={46} minSize={25}>
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
            <SymbolPicker onPick={pickSymbol} symbol={symbol} />
            <span className={`ml-auto text-xs ${statusTone}`} data-testid="compile-status">
              {label.text}
            </span>
            {dirty ? (
              <span className="text-xs text-muted-foreground" data-testid="dirty-indicator" title="Unsaved changes">
                ●
              </span>
            ) : null}
            {alertCount > 0 ? (
              <Badge title="Alerts fired this run" variant="secondary">
                <BellIcon /> {alertCount}
              </Badge>
            ) : null}
          </div>
          <div className="min-h-0 flex-1">
            <EditorPane
              initialSource={source}
              key={`${editorKey}-${editorTheme}`}
              onSourceChange={setSource}
              service={service}
              theme={editorTheme}
            />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={36} minSize={25}>
        <ChartPane artifact={artifact} bars={bars} onAlert={() => setAlertCount((n) => n + 1)} />
      </ResizablePanel>

      {/* Unsaved-changes guard before loading another script. */}
      <Dialog onOpenChange={(open) => !open && setPendingLoadId(null)} open={pendingLoadId !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved edits. Loading another script will discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep editing</DialogClose>
            <Button
              data-testid="confirm-discard"
              onClick={() => {
                const id = pendingLoadId
                setPendingLoadId(null)
                if (id !== null) doLoad(id)
              }}
              type="button"
              variant="destructive"
            >
              Discard & load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResizablePanelGroup>
  )
}
