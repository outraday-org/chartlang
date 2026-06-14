// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createFileRoute } from "@tanstack/react-router"

import { EmbeddedDemo } from "@/components/demo/EmbeddedDemo"
import { Features } from "@/components/landing/Features"
import { Hero } from "@/components/landing/Hero"
import { Quickstart } from "@/components/landing/Quickstart"

export const Route = createFileRoute("/")({ component: HomeRoute })

function HomeRoute() {
  return (
    <>
      <Hero />
      <Features />
      <Quickstart />
      <EmbeddedDemo />
    </>
  )
}
