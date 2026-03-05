# Frontend Architecture

## Overview

The EchoCenter frontend is a Single Page Application (SPA) based on React, developed with TypeScript, and uses Vite as the build tool.

## Tech Stack

- **React 19** - UI Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling Framework
- **shadcn/ui** - UI Component Library
- **Lucide React** - Icon Library
- **Zustand** - State Management
- **React Router** - Routing Management
- **TanStack Query** - Data Fetching and Synchronization (Optional)

## Directory Structure

```
frontend/
├── src/
│   ├── assets/         # Static assets
│   ├── components/     # Common components
│   ├── context/        # React Context
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utility functions and library configurations
│   ├── pages/          # Page components
│   ├── store/          # Zustand state stores
│   ├── types/          # TypeScript type definitions
│   └── App.tsx         # Root component
└── vite.config.ts      # Vite configuration
```

## Core Concepts

### 1. State Management
Uses Zustand for lightweight global state management, primarily used to store user information, message lists, and system settings.

### 2. Real-time Communication
Communicates bidirectionally with the backend via WebSocket. The frontend implements a `useWebSocket` hook to handle connections, reconnection, and message distribution.

### 3. Data Synchronization & Optimistic UI
To ensure a fluid user experience while maintaining strict sequential integrity in a distributed environment:
- **Optimistic Rendering**: When a user sends a message, the frontend instantly generates a globally unique `local_id` (UUID) and appends the message to the view immediately.
- **Deduplication & Replacement**: Upon receiving the server echo (for human senders) the frontend matches by `local_id` and replaces temporary messages with authoritative server records (`id`).
- **Stable Ordering**: Messages are merged and sorted deterministically (timestamp, then server `id`, then local fallback keys) to keep history consistent across refresh/reconnect.
- **Per-Conversation Pending State**: Waiting indicators are tracked by peer (`pendingByPeer`) to avoid cross-chat interference.

### 4. UI Components
Built based on `shadcn/ui`, following consistent design specifications, and supporting responsive layout and dark mode.

### 5. Internationalization (i18n)
- Global language state is provided by `I18nContext`.
- Users can switch between English and Simplified Chinese from the top navigation.
- Language preference is persisted in `localStorage` (`echocenter-locale`) and synced to `document.documentElement.lang`.

### 6. Admin Workspace
- The sidebar now uses **Settings** as the admin entry.
- Settings includes two operation panels:
  - **Agent Operations**: create agents, refresh/remove agent tokens, and verify connectivity.
  - **Integrations**: configure external channels such as Feishu and route messages to Butler.

### 7. Butler Workspace
- **Me ↔ Butler** mode: direct 1-on-1 channel with Butler.
- **Butler ↔ Agents** mode: monitor Butler dispatch timeline and cross-agent interactions.
- Empty monitor history now stays static (`No Monitor Messages`) without spinner noise.

## Development and Build

### Run Development Server
```bash
npm run dev
```

### Build Production Version
```bash
npm run build
```
