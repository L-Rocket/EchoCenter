# Data Model: Dark and Light Mode Toggle

## Client-Side State (React Context & Local Storage)

The theme preference is exclusively a client-side concern and does not interact with the backend database.

### `Theme` Type
- **Type**: `string` literal union
- **Values**: `"dark" | "light" | "system"`
- **Description**: Represents the user's selected theme preference.

### Local Storage Key
- **Key**: `vite-ui-theme` (configurable, but standard for this stack)
- **Value**: String representation of the `Theme` type.
- **Behavior**: Read on initial application load (via inline script to prevent FOUC and in Context initialization) and written to whenever the user manually changes their preference.

## State Transitions
1. **Initial Load (No localStorage)**: State initializes to `"system"`. A listener evaluates `window.matchMedia('(prefers-color-scheme: dark)')` to determine the actual rendered class.
2. **User selects "Dark"**: State updates to `"dark"`. Local storage saves `"dark"`. The `.dark` class is explicitly added to `<html>`.
3. **User selects "Light"**: State updates to `"light"`. Local storage saves `"light"`. The `.dark` class is explicitly removed from `<html>`.
4. **User selects "System"**: State updates to `"system"`. Local storage saves `"system"`. The class is applied based on the current OS preference via `matchMedia`.
