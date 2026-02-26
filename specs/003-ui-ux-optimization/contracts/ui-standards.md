# UI Standards: EchoCenter

## Visual Identity
- **Primary Color**: Indigo (#4f46e5) for branding and key actions.
- **Secondary Surface**: White (#ffffff) for cards and modals.
- **Background**: Slate-50 (#f8fafc) for depth.
- **Typography**: Inter (Sans-serif) with 14px base size for data, 16px for prose.

## Component Usage
- **Badges**: 
    - INFO: `secondary` variant (Slate/Gray).
    - WARNING: `warning` custom variant (Amber).
    - ERROR: `destructive` variant (Red).
- **Cards**: All agent messages MUST be wrapped in a Shadcn Card component with standard padding (`p-4`).
- **Layout**: The dashboard MUST use a `max-w-5xl` container, centered on the screen.

## Responsive Rules
- **Desktop**: Sidebar or large horizontal header.
- **Mobile (< 640px)**: Stacked layout, full-width cards, compact padding (`p-3`).

## Interaction Feedback
- All buttons MUST have a subtle scale effect or background change on hover.
- "Loading" states MUST be represented by a standard Spinner or Skeleton component from the shared library.
