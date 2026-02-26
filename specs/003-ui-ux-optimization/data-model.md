# Data Model: UI/UX Optimization

## Entity: UIThemeConfig (Tailwind Variables)
Defines the visual "DNA" of the EchoCenter project.

| Variable | Default Value | Usage |
|----------|---------------|-------|
| `--background` | Slate 50 | Main app background |
| `--primary` | Indigo 600 | Buttons, active links |
| `--destructive` | Red 600 | Error messages, delete actions |
| `--muted` | Slate 500 | Helper text, timestamps |
| `--radius` | 0.5rem | Border radius for all components |

## Entity: SharedComponents (React)
The library of primitives to be used for all UI development.

- **Card**: Wrapper for message rows and sections.
- **Badge**: Status indicators (INFO, WARNING, ERROR).
- **Button**: Actions like "Logout" or "Invite User".
- **StatusIndicator**: Visual dot or icon showing real-time health.
