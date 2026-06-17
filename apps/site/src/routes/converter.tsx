// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createFileRoute } from "@tanstack/react-router"

import { ConverterPanel } from "@/components/converter/ConverterPanel"

export const Route = createFileRoute("/converter")({ component: ConverterRoute })

function ConverterRoute() {
  return <ConverterPanel />
}
