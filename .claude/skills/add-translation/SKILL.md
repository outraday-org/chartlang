---
name: add-translation
description: Guide for adding internationalized strings to the project using Lingui. Use when adding user-visible text, translating UI elements, or working with i18n patterns.
---

# Add Translation (i18n)

This skill guides you through adding internationalized strings to the project.

## Overview

The project uses Lingui for internationalization. All user-visible text should be wrapped for translation.

## Basic Usage

### JSX Component Text

```tsx
import { Trans } from "@lingui/react/macro";

// Simple text
<Trans>Welcome to the app</Trans>

// With variables
<Trans>Hello, {userName}</Trans>

// Inside attributes (use Trans with render prop or t macro)
<button aria-label={t`Close dialog`}>×</button>
```

### String Literals

```typescript
import { t } from "@lingui/core/macro";

// In JavaScript/TypeScript
const message = t`Item created successfully`;

// With variables
const greeting = t`Hello, ${name}!`;

// In objects
const options = [
    { value: "active", label: t`Active` },
    { value: "archived", label: t`Archived` }
];
```

### Pluralization

```tsx
import { Plural } from "@lingui/react/macro";

<Plural
    value={count}
    one="# item"
    other="# items"
/>

// With zero
<Plural
    value={count}
    zero="No items"
    one="# item"
    other="# items"
/>
```

## Dictionary Pattern

Create dictionary files for reusable translations:

```typescript
// src/dictionary/projects/t-custom-canvas-shape-type.ts
import { t } from "@lingui/core/macro";
import { CustomCanvasShapeType } from "convex/canvas/customShapes/customCanvasShapes";

export const tCustomCanvasShapeType = (type: CustomCanvasShapeType): string => {
    switch (type) {
        case CustomCanvasShapeType.CARD:
            return t`Card`;
        case CustomCanvasShapeType.PRICE_CHART:
            return t`Price Chart`;
        case CustomCanvasShapeType.FUNDAMENTAL_CHART:
            return t`Fundamental Chart`;
        case CustomCanvasShapeType.MY_WIDGET:
            return t`My Widget`;
        default:
            return t`Unknown`;
    }
};
```

### Dictionary Folder Structure

```
src/dictionary/
├── common/
│   ├── t-common-actions.ts     # Save, Cancel, Delete, etc.
│   ├── t-common-labels.ts      # Name, Description, etc.
│   └── t-error-messages.ts     # Error messages
├── projects/
│   ├── t-custom-canvas-shape-type.ts
│   └── t-project-status.ts
└── users/
    └── t-user-roles.ts
```

### Using Dictionary Functions

```tsx
import { tCustomCanvasShapeType } from "@/dictionary/projects/t-custom-canvas-shape-type";

// In component
<span>{tCustomCanvasShapeType(shape.type)}</span>

// In menu
const menuItems = shapes.map(shape => ({
    label: tCustomCanvasShapeType(shape.type),
    value: shape.type
}));
```

## Commands

```bash
# Extract translatable strings from codebase
pnpm lingui:extract

# Clean up unused translations
pnpm lingui:clean

# Extract + clean in one command
pnpm lingui:update

# Compile translations to TypeScript
pnpm lingui:compile

# Full workflow (update + compile)
pnpm lingui:build
```

## Workflow

1. **Add translations in code** using `<Trans>` or `t\`\``
2. **Run `pnpm lingui:extract`** to update message catalogs
3. **Translate** the new messages in locale files
4. **Run `pnpm lingui:compile`** to generate runtime files

## Best Practices

### Do's

```tsx
// Use Trans for JSX text
<Trans>Save changes</Trans>

// Use t for strings
const label = t`Submit`;

// Use dictionary functions for enums/types
tCustomCanvasShapeType(type)

// Include context in translations
<Trans>Delete {itemName}</Trans>
```

### Don'ts

```tsx
// Don't hardcode strings
<button>Save</button>  // Bad

// Don't concatenate strings
const msg = t`Hello` + " " + name;  // Bad
const msg = t`Hello ${name}`;       // Good

// Don't use template literals without t
const label = `Welcome, ${name}`;   // Bad - not translatable
const label = t`Welcome, ${name}`;  // Good
```

## Where to Add Translations

### Always Translate

- UI labels and buttons
- Error messages shown to users
- Placeholder text
- Toast notifications
- Dialog titles and content
- Menu items
- Tooltips

### Don't Translate

- Log messages (console.log, console.error)
- Technical error messages (for debugging)
- API keys, IDs, code identifiers
- Comments in code

## Examples

### Form Labels

```tsx
<label>
    <Trans>Email address</Trans>
    <input type="email" placeholder={t`Enter your email`} />
</label>
```

### Error Messages

```tsx
if (!user) {
    toast.error(t`You must be logged in to perform this action`);
}
```

### Dynamic Content

```tsx
<Trans>
    You have <strong>{count}</strong> unread messages
</Trans>

// With plural
<Trans>
    <Plural value={count} one="# new notification" other="# new notifications" />
</Trans>
```

### Select (Gender/Choices)

```tsx
import { Select } from "@lingui/react/macro";

<Select
    value={gender}
    male="He liked this"
    female="She liked this"
    other="They liked this"
/>
```

## Locale Files

Translation files are stored in `src/locales/`:

```
src/locales/
├── en/
│   └── messages.po
├── de/
│   └── messages.po
└── es/
    └── messages.po
```

After running `pnpm lingui:extract`, new strings appear in `.po` files:

```po
#: src/components/MyComponent.tsx:42
msgid "Welcome to the app"
msgstr ""
```

Translators fill in the `msgstr`:

```po
#: src/components/MyComponent.tsx:42
msgid "Welcome to the app"
msgstr "Willkommen in der App"
```
