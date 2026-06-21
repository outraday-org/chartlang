// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// US-symbol picker — a shadcn `CommandDialog` combobox over Task 4's
// browser-safe `eodClient.searchSymbols`. Selecting a hit calls back to the
// page, which runs `loadSymbol` and feeds the bars to the chart. Search is
// server-side (cache-first; no quota cost when warm), so cmdk's local filter
// is disabled (`shouldFilter={false}`) and the query is debounced here.

import { searchSymbols, type SymbolHit } from "@/lib/eodClient"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { SearchIcon } from "lucide-react"
import { type ReactElement, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

const SEARCH_DEBOUNCE_MS = 250

/**
 * Props for {@link SymbolPicker}. `symbol` is the currently-loaded ticker (or
 * null when none is loaded); `onPick` fires with the chosen ticker so the page
 * owns the `loadSymbol` call + quota accounting.
 */
export type SymbolPickerProps = Readonly<{
  symbol: string | null
  onPick: (symbol: string) => void
  disabled?: boolean
}>

export function SymbolPicker(props: SymbolPickerProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<ReadonlyArray<SymbolHit>>([])
  const [loading, setLoading] = useState(false)
  const reqIdRef = useRef(0)

  // Debounced server search. Each keystroke supersedes the prior in-flight
  // request via a monotonic request id, so a slow response can't clobber a
  // newer one. An empty query clears the list (no fetch).
  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed === "") {
      setHits([])
      setLoading(false)
      return
    }
    const id = ++reqIdRef.current
    setLoading(true)
    const timer = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const result = await searchSymbols(trimmed)
          if (reqIdRef.current === id) setHits(result)
        } catch (err) {
          if (reqIdRef.current === id) {
            setHits([])
            toast.error(err instanceof Error ? err.message : "Symbol search failed")
          }
        } finally {
          if (reqIdRef.current === id) setLoading(false)
        }
      })()
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, open])

  const pick = (code: string): void => {
    setOpen(false)
    setQuery("")
    setHits([])
    props.onPick(code)
  }

  return (
    <>
      <Button
        disabled={props.disabled}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <SearchIcon />
        {props.symbol ?? "Pick symbol"}
      </Button>
      <CommandDialog
        description="Search US daily symbols"
        onOpenChange={setOpen}
        open={open}
        title="Pick a symbol"
      >
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setQuery}
            placeholder="Search US symbols (e.g. AAPL)…"
            value={query}
          />
          <CommandList>
            <CommandEmpty>
              {query.trim() === ""
                ? "Type to search US symbols (free tier: daily EOD, US only)."
                : loading
                  ? "Searching…"
                  : "No US symbols match — the free tier covers AMEX / NASDAQ / NYSE / OTCBB."}
            </CommandEmpty>
            {hits.length > 0 ? (
              <CommandGroup heading="US symbols">
                {hits.map((hit) => (
                  <CommandItem key={`${hit.exchange}:${hit.code}`} onSelect={() => pick(hit.code)} value={hit.code}>
                    <span className="font-mono">{hit.code}</span>
                    <span className="truncate text-muted-foreground">{hit.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{hit.exchange}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
