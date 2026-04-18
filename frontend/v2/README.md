# EchoCenter Frontend — v2 (Design Prototype)

Linear/Vercel-style redesign handed off from Claude Design.

## What this is

A **zero-build HTML/CSS/JS prototype**:
- `index.html` — scaffold, fonts, design tokens, inline CSS
- `styles.css` — standalone stylesheet (mirror of the inline styles)
- `src/*.jsx` — page modules loaded via Babel-standalone at runtime

React, ReactDOM, and Babel are pulled from CDN — there is no bundler, no TypeScript, no build step.

## Run

```bash
npm run dev        # serves on :5173 via python3 -m http.server
```

Or from the repo root:

```bash
make dev-frontend FRONTEND_VERSION=v2
```

## Scripts

| Script  | Behavior                                                    |
| ------- | ----------------------------------------------------------- |
| `dev`   | `python3 -m http.server 5173`                               |
| `build` | Copies `index.html`, `styles.css`, `src/` into `dist/`      |
| `lint`  | no-op (prototype has no JS/TS lint configured)              |
| `test`  | no-op (prototype has no tests)                              |

## Status

This is the design reference. Implementing it against the real backend (auth, API wiring, i18n, routing, etc.) is pending — v1 remains the production frontend until v2 is wired up.
