# Frontend Architecture

## Overview

The EchoCenter frontend is a Single Page Application (SPA) based on React, developed with TypeScript, and uses Vite as the build tool.

## Tech Stack

- **React 18+** - UI Framework
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
- **Deduplication & Replacement**: Upon receiving the server's broadcasted echo of that message, the frontend matches it using the `local_id` and seamlessly replaces the temporary local message with the authoritative server message (which now carries the definitive database `id`).
- **Absolute Ordering**: Local timestamp-based sorting is abandoned in favor of strict mathematical sorting based purely on the database sequence `id`.

### 4. UI Components
Built based on `shadcn/ui`, following consistent design specifications, and supporting responsive layout and dark mode.

## Development and Build

### Run Development Server
```bash
npm run dev
```

### Build Production Version
```bash
npm run build
```
