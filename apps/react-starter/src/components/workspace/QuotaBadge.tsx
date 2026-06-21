// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// EODData free-tier quota indicator. Reads Task 4's `eodClient.getUsage`
// (browser-safe) and shows `remaining/limit` calls for the current UTC day.
// `refreshKey` bumps a re-fetch after each `loadSymbol`, so a fresh network
// call (which spends quota) updates the badge; cache hits leave it unchanged.

import { getUsage, type UsageInfo } from "@/lib/eodClient"
import { Badge } from "@/components/ui/badge"
import { type ReactElement, useEffect, useState } from "react"

export type QuotaBadgeProps = Readonly<{
  /** Bump to re-fetch usage (e.g. after a symbol load). */
  refreshKey: number
}>

export function QuotaBadge(props: QuotaBadgeProps): ReactElement {
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async (): Promise<void> => {
      try {
        const next = await getUsage()
        if (!cancelled) {
          setUsage(next)
          setError(false)
        }
      } catch {
        // A missing key (or any usage error) makes the quota unknowable; show a
        // muted "no EOD key" hint rather than a number.
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.refreshKey])

  if (error || usage === null) {
    return (
      <Badge title="Set EODDATA_API_KEY in .env to load market data." variant="outline">
        {error ? "no EOD key" : "quota …"}
      </Badge>
    )
  }

  const limit = usage.calls + usage.remaining
  const low = usage.remaining <= 0
  return (
    <Badge
      title={`EODData calls used today (UTC ${usage.day}). Free tier: ${limit}/day.`}
      variant={low ? "destructive" : "secondary"}
    >
      {usage.remaining}/{limit} left
    </Badge>
  )
}
