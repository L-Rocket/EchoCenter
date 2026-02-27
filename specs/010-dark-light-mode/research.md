# Research: Dark and Light Mode Toggle

## Theme State Management

- **Decision**: Use a custom React Context (`ThemeProvider`) to manage the theme state (`light`, `dark`, `system`).
- **Rationale**: This is the canonical approach recommended by `shadcn/ui` and Vite ecosystem for Tailwind CSS projects. It avoids prop drilling, provides a centralized place to handle `localStorage` synchronization, and cleanly manages the application of the `.dark` class to the root `<html>` element.
- **Alternatives considered**: 
  - Using a global state store like Zustand (which is already in the project dependencies). While feasible, a dedicated Context for theme is a standard pattern that isolates UI preferences from business logic state.

## CSS Implementation

- **Decision**: Leverage existing Tailwind CSS `dark:` variant and CSS variables defined in `frontend/src/index.css`.
- **Rationale**: The `index.css` file already contains a `.dark` selector defining the oklch color palette for dark mode. Tailwind 4 integrates perfectly with this by recognizing the `.dark` class on the root element.
- **Alternatives considered**: 
  - CSS `@media (prefers-color-scheme: dark)` only. This would limit users from manually overriding the OS preference, failing User Story 1.

## UI Component Placement

- **Decision**: Implement a theme toggle button (using `lucide-react` Sun/Moon icons) and place it in the top-right corner of `MainLayout.tsx`'s header.
- **Rationale**: Meets the user's specific request ("右上角切换") and provides an immediately accessible, predictable location for the setting.

## Flash of Unstyled Content (FOUC) Prevention

- **Decision**: Add an inline `<script>` tag in `index.html` to synchronously check `localStorage` and OS preference before React hydrates.
- **Rationale**: This guarantees that the `.dark` class is applied to the DOM before the browser renders the first frame, preventing the UI from flashing light before switching to dark mode.
