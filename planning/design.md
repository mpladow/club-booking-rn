# Design System Token Dictionary

## 1. Visual Theme Guardrails

- **Design Philosophy:** Minimalist, high-contrast, clean typography, whitespace-heavy.
- **Component Roundness:** Medium radius rounded corners on primary interface surfaces.
- **System Modes:** Strict **Light Mode Only** for Phase 1 MVP.

## 2. Color Tokens (NativeWind / Tailwind v4)

Always map layout styles semantically using these specific token names:

| Token Name          | Tailwind Utility     | Hex Code (Reference Only) | Application Target                                  |
| :------------------ | :------------------- | :------------------------ | :-------------------------------------------------- |
| **`bg-canvas`**     | `bg-neutral-50`      | `#F9F9F9`                 | Root screens, main viewport layouts                 |
| **`bg-surface`**    | `bg-white`           | `#FFFFFF`                 | Bottom sheets, cards, floating modals               |
| **`brand-primary`** | `bg-indigo-600`      | `#4F46E5`                 | Interactive buttons, step highlights, active states |
| **`text-main`**     | `text-neutral-900`   | `#111827`                 | Headings, core body labels, primary numbers         |
| **`text-muted`**    | `text-neutral-500`   | `#6B7280`                 | Subtitles, helper text, empty placeholders          |
| **`border-subtle`** | `border-neutral-200` | `#E5E7EB`                 | Dividers, subtle input card borders                 |

## 3. Typography Hierarchy

Do not use arbitrary font sizing values. Stick strictly to this structured layout utility tree:

- **Screen Title:** `text-2xl font-bold tracking-tight text-neutral-900`
- **Card Heading:** `text-lg font-semibold text-neutral-900`
- **Body / Form Label:** `text-base font-medium text-neutral-900`
- **Sub-text / Caption:** `text-sm text-neutral-500`

## 4. Spacing, Padding, & Component Layouts

Maintain consistent visual density using structured flex boundaries:

| UI Component           | Padding / Spacing Constraints                                     | NativeWind Utility                                 |
| :--------------------- | :---------------------------------------------------------------- | :------------------------------------------------- |
| **Screen Wrap**        | Safe Area main container bounds padding                           | `px-5 pt-4`                                        |
| **Card List Element**  | Internal element padding & vertical gap spacing                   | `p-4 mb-3`                                         |
| **Interactive Button** | Standard height container sizing with inside label flex centering | `h-12 rounded-xl flex items-center justify-center` |
| **Form Row Inputs**    | Standard sizing block gap boundaries                              | `space-y-4`                                        |

## 5. Active & Focused States

- **Pressable Interaction:** When an item is active or pressed, lower its opacity to `active:opacity-75`.
- **Form Inputs Focused:** Accent input boundaries during active focus typing: `focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600`.

## 6. Button Component Variants

All buttons must be built using a flexible primitive structure wrapping a `Pressable` and a `Text` element. Standardise layout behaviors using this variant matrix:

| Variant                  | Container Tailwind Utility Classes                                                                                          | Text Tailwind Utility Classes              | Use Case                                                          |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- | :---------------------------------------------------------------- |
| **Contained (Primary)**  | `h-12 bg-indigo-600 rounded-xl flex flex-row items-center justify-center px-4 active:opacity-80`                            | `text-base font-semibold text-white`       | Primary actions, submit buttons, main booking flows.              |
| **Outlined (Secondary)** | `h-12 bg-transparent border border-neutral-200 rounded-xl flex flex-row items-center justify-center px-4 active:opacity-70` | `text-base font-semibold text-neutral-900` | Secondary choices, cancel actions, "Go Back" flows.               |
| **Text (Tertiary)**      | `h-12 bg-transparent flex flex-row items-center justify-center px-4 active:opacity-60`                                      | `text-base font-medium text-indigo-600`    | Low-emphasis options, skip actions, auxiliary links.              |
| **Toggle (Active)**      | `h-12 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-row items-center justify-center px-4`                      | `text-base font-semibold text-indigo-600`  | Multi-select buttons or active time slots in the booking wizard.  |
| **Toggle (Inactive)**    | `h-12 bg-white border border-neutral-200 rounded-xl flex flex-row items-center justify-center px-4 active:opacity-80`       | `text-base font-normal text-neutral-600`   | Unselected options or available time slots in the booking wizard. |

## 7. Menu Tiles

Use `MenuTile` from `@/components/ui/MenuTile` for reusable menu actions. It provides
the leading Expo Ionicon, title, optional subtitle, trailing arrow, standard spacing,
focus/pressed states and disabled styling. Pass an `onPress` handler; keep routing,
permissions and the surrounding responsive layout in the consuming screen.

The `icon` prop accepts any Ionicons name through the exported `MenuTileIcon` type.
The default accessibility label combines the title and subtitle; consumers can supply
an accessibility label/hint, test ID and other Pressable interaction props. Tile styling
is owned by the component so consumers stay consistent.
