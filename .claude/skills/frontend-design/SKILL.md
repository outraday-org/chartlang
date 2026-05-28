---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces for the Invinite project. Implement real working code using the project's existing component library, conventions, and design tokens — while making creative, memorable design choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

Then implement working code that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail
- Built entirely with the project's existing component library and conventions

## Project Stack

- **React 19** with React Compiler
- **Tailwind CSS v4** — `@theme` tokens, `@layer base`, no `tailwind.config`
- **Shadcn/Base UI** primitives in `src/components/ui/`
- **CVA** (`class-variance-authority`) for multi-variant components
- **`cn()`** from `@/lib/utils/classes/cn` for class merging
- **Lingui** — wrap all user-visible text with `<Trans>` or `` t`...` ``
- **`@fluentui/react-context-selector`** for all React contexts (never plain `createContext`)
- **Zustand** for global state, **React Query** for external data, **Convex** for real-time

## Available UI Primitives

Always use existing components from `src/components/ui/` — never recreate:

| Component | Import path | Notes |
|-----------|-------------|-------|
| `Button` | `@/components/ui/buttons/Button` | CVA variants: `primary`, `secondary`, `ghost`, `ghost-strong`, `outline`, `dashed`, `destructive`, `mono`, `dim`, `foreground`, `inverse`, `toolbar`, `success`. Sizes: `xs`, `sm`, `md`, `lg`, `icon`, `icon-sm`. Modes: `default`, `icon`, `link`, `input`, `underline`. |
| `DropdownMenu` | `@/components/ui/dropdown-menu/DropdownMenu` | **Preferred for all selection patterns.** Base UI `Menu` wrapper. Uses `render` prop (not `asChild`). Data attributes: `data-[open]`/`data-[closed]`. Use `DropdownMenuRadioGroup` + `DropdownMenuRadioItem` for single-select, `DropdownMenuCheckboxItem` for multi-select. Supports `DropdownMenuSub` for nested menus. |
| `Dialog` | `@/components/ui/popups/dialog/Dialog` | Base UI `Dialog` wrapper. `DialogTrigger` and `DialogClose` use `render` prop (not `asChild`): `<DialogTrigger render={<Button />}>label</DialogTrigger>`. Data attributes: `data-[open]`/`data-[closed]`. `DialogContent` accepts `zIndex`, `animation`, `transparentOverlay`, `noCloseOnClickOutside`. |
| `Popover` | `@/components/ui/popups/popover/Popover` | `PopoverContent` supports `draggable`, `resizable`, `center`, `zIndex`. |
| `Tooltip` | `@/components/ui/tooltip/tooltip` | Base UI tooltip. `TooltipTrigger` uses `render` prop (not `asChild`): `<TooltipTrigger render={<Button />}>label</TooltipTrigger>`. `TooltipProvider` accepts `delay`/`timeout`. |
| `Input`, `InputGroup`, `NumberInput`, `TagsInput` | `@/components/ui/input/` | `InputGroup` composes inputs with prefix/suffix slots. |
| `Tabs` | `@/components/ui/tabs/Tabs` | Base UI Tabs wrapper. |
| `Badge`, `StatusBadge` | `@/components/ui/badge/Badge` | CVA-based with variants. |
| `Item`, `ItemGroup` | `@/components/ui/item/Item` | Compound list-item primitive; variants: `default`, `outline`, `muted`. |
| `ScrollArea` | `@/components/ui/scroll-area/ScrollArea` | Base UI ScrollArea. |
| `Skeleton` | `@/components/ui/skeleton/Skeleton` | Loading placeholder. |
| `Spinner`, `LoadingSpinner` | `@/components/ui/spinner/`, `@/components/ui/loading-spinner/` | Inline and full-area loaders. |
| `Empty` | `@/components/ui/empty/Empty` | Compound empty-state: `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyAction`. |
| `Avatar`, `UserAvatar` | `@/components/ui/avatar/` | Custom HTML Avatar; `UserAvatar` resolves Clerk data. |
| `Checkbox`, `Switch`, `Slider`, `DualRangeInput` | `@/components/ui/checkbox/`, `switch/`, `slider/` | Custom checkbox/switch, Base UI Slider, native `<input type="range">`-based dual-thumb range slider (use this when the slider lives next to a deck.gl canvas where Base UI Slider drags get pre-empted). |
| `Card` | `@/components/ui/card/Card` | Shadcn Card. |
| `Sheet` | `@/components/ui/sheet/Sheet` | Base UI `Sheet` (slide-in drawer, built on `@base-ui/react/dialog`). Data attributes: `data-[open]`/`data-[closed]`. |
| `Separator` | `@/components/ui/separators/Separator` | Custom HTML Separator with duplicate-hiding logic. |
| `ViewModeToggle`, `GridCard`, `ListRow` | `@/components/ui/view-mode/` | Grid/list view switcher. |

## Selection Pattern: Prefer DropdownMenu over Select

**Always use `DropdownMenu` instead of `Select` for selection UI.** The `DropdownMenu` component provides:
- More flexible content (icons, descriptions, sub-menus)
- Better styling control and consistency with the app's design language
- `DropdownMenuRadioGroup` / `DropdownMenuRadioItem` for single-select
- `DropdownMenuCheckboxItem` for multi-select
- `DropdownMenuSub` / `DropdownMenuSubTrigger` / `DropdownMenuSubContent` for nested selection

Typical pattern for a selection trigger:

```tsx
<DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline" mode="input" size="sm" />}>
        {selectedLabel}
    </DropdownMenuTrigger>
    <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
    </DropdownMenuContent>
</DropdownMenu>
```

Only use `Select` from `@/components/ui/select/Select` (Base UI-based) when you need native form integration or the trigger must display the selected value automatically via `<SelectValue>`.

## Design Tokens & Theming

Use the project's CSS variables — never hardcode colors or shadows:

- **Primary** (green): `bg-primary`, `text-primary`, `bg-primary-hover`, `bg-primary-active`
- **Secondary**: `bg-secondary`, `bg-secondary-hover`, `bg-secondary-active`
- **Destructive** (red): `bg-destructive`, `text-destructive`
- **Muted**: `bg-muted`, `text-muted-foreground`
- **Accent**: `bg-accent`, `text-accent-foreground`
- **Foreground**: `text-foreground`, `text-foreground-medium`
- **Semantic**: `text-success-accent`, `bg-success-soft`, `text-warning-accent`, `bg-warning-soft`, `text-info-accent`, `bg-info-soft`
- **Shadows**: `shadow-dropdown`, `shadow-popup`, `shadow-sidebar`
- **Border radius**: default is `rounded-[var(--radius)]` (0.65rem)

**Font**: Inter with system-ui fallbacks (set globally — do not override the base font).

**Dark mode**: Supported via `.dark` class. Use Tailwind's `dark:` variant. All CSS variables have dark mode overrides.

## Border Classes

For 1px solid borders, use the custom classes from `global.css`:
- `border-bottom`, `border-top`, `border-left`, `border-right` — instead of Tailwind's `border-b`, `border-t`, `border-l`, `border-r`
- These apply `1px solid var(--border)` in one class

## Z-Index Management

All portaled/fixed UI must use constants from `@/lib/z-index`:

```ts
import { Z_INDEX } from "@/lib/z-index";
```

Pass `zIndex` prop to `DialogContent`, `PopoverContent`, `DropdownMenuContent`, etc. Never hardcode z-index values above 999.

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Creative use of font weights (light 300 through bold 700), tracking (`tracking-normal`, `tracking-wide`), and the type scale (`text-2xs` through `text-2xl`). Use contrast between sizes and weights for visual hierarchy.
- **Color & Theme**: Commit to a cohesive aesthetic using the project's design tokens. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Use semantic colors purposefully.
- **Motion**: Use CSS animations and transitions. Use `motion/react` library when available. Focus on high-impact moments: staggered reveals, scroll-triggered effects, hover states that surprise. Use the existing animation classes: `animate-shake`, `animate-highlight-flash`, `animate-indeterminate`.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth. Apply creative gradients, noise textures, geometric patterns, layered transparencies, dramatic shadows.

NEVER use generic AI-generated aesthetics like overused font families, cliched color schemes (particularly purple gradients), predictable layouts, or cookie-cutter design.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. NEVER converge on common choices across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code. Minimalist designs need restraint and precision. Elegance comes from executing the vision well.

## Code Style Rules

- Never use `any` — use `unknown`
- Never use `as` — except `as const`
- Never use `++`/`--` — use `+= 1`/`-= 1`
- Never use `() => {}` — use `() => undefined`
- Never create `index.ts` or `index.tsx` files
- Components → PascalCase filenames; hooks/utils → kebab-case
- Use `Id<"tableName">` for Convex IDs, not `string`
- Use document type aliases from `convex/schemaTypes`, never `Doc<"table">` directly

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.
