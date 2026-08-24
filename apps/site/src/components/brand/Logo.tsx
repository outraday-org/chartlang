// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ReactElement } from "react"
import fullLogoUrl from "../../../../../brand/chartlang_logo_full.png?url"
import markUrl from "../../../../../brand/chartlang_logo_256.png?url"

export type LogoProps = Readonly<{
  variant?: "mark" | "full"
  className?: string
  size?: number
}>

const FULL_LOGO_ASPECT_RATIO = 2018 / 361

/**
 * The chartlang logo: the supplied square mark (`mark`) or the complete
 * icon-and-wordmark lockup (`full`). Both variants render their canonical
 * PNG from `brand/`; the full variant never reconstructs the lockup with
 * live text.
 */
export function Logo({ variant = "full", className, size = 24 }: LogoProps): ReactElement {
  if (variant === "mark") {
    return (
      <span className={className} style={{ display: "inline-flex" }}>
        <img src={markUrl} width={size} height={size} alt="chartlang" style={{ display: "block" }} />
      </span>
    )
  }
  return (
    <span className={className} style={{ display: "inline-flex" }}>
      <img
        src={fullLogoUrl}
        width={Math.round(size * FULL_LOGO_ASPECT_RATIO)}
        height={size}
        alt="chartlang"
        style={{ display: "block" }}
      />
    </span>
  )
}
