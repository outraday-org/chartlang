// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// US-symbol entry — a plain ticker input (type AAPL → Enter / Load). The page
// owns the `loadSymbol` call via `onPick`. The server loads the symbol's daily
// history from Yahoo Finance (free, no API key) on load, so the user only needs
// to know the ticker. Submitting goes through a `<form>` with `preventDefault`
// so Enter never reloads the page.

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "lucide-react"
import { type FormEvent, type ReactElement, useEffect, useState } from "react"

/**
 * Props for {@link SymbolPicker}. `symbol` is the currently-loaded ticker (or
 * null when none is loaded); `onPick` fires with the entered ticker so the page
 * owns the `loadSymbol` call.
 */
export type SymbolPickerProps = Readonly<{
  symbol: string | null
  onPick: (symbol: string) => void
  disabled?: boolean
}>

export function SymbolPicker(props: SymbolPickerProps): ReactElement {
  const [value, setValue] = useState(props.symbol ?? "")

  // Reflect an externally-loaded symbol (e.g. opening a saved script that
  // carries one) in the input so it shows what the chart is rendering.
  useEffect(() => {
    setValue(props.symbol ?? "")
  }, [props.symbol])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const ticker = value.trim().toUpperCase()
    if (ticker !== "") props.onPick(ticker)
  }

  return (
    <form className="flex items-center gap-1.5" onSubmit={submit}>
      <Input
        aria-label="Ticker symbol"
        autoCapitalize="characters"
        className="h-8 w-36 font-mono uppercase"
        disabled={props.disabled}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ticker e.g. AAPL"
        spellCheck={false}
        value={value}
      />
      <Button
        disabled={props.disabled || value.trim() === ""}
        size="sm"
        type="submit"
        variant="outline"
      >
        <SearchIcon />
        Load
      </Button>
    </form>
  )
}
