// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ReactElement } from "react"
import markUrl from "../../../../../brand/chartlang_logo.svg?url"

export type LogoProps = Readonly<{
  variant?: "mark" | "full"
  className?: string
  size?: number
}>

function Mark({ size }: { size: number }): ReactElement {
  return (
    <img
      src={markUrl}
      width={size}
      height={size}
      alt="chartlang"
      style={{ borderRadius: "22%", display: "block" }}
    />
  )
}

/**
 * The chartlang logo: the brand mark (`mark`) or the mark plus the
 * `chartlang` wordmark (`full`). The mark renders the single-source
 * `brand/chartlang_logo.svg` (same file as the favicon); the wordmark
 * text recolors with the `--foreground` token for dark/light mode.
 */
export function Logo({ variant = "full", className, size = 24 }: LogoProps): ReactElement {
  if (variant === "mark") {
    return (
      <span className={className} style={{ display: "inline-flex" }}>
        <Mark size={size} />
      </span>
    )
  }
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
    >
      <Mark size={size} />
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 800,
          fontSize: `${size * 0.72}px`,
          letterSpacing: "-0.02em",
          color: "var(--foreground)",
        }}
      >
        chartlang
      </span>
    </span>
  )
}
