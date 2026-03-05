# API Endpoints

## Overview

EchoCenter provides a set of RESTful API endpoints for managing users, agents, and messages.

## Authentication

All API requests (except for login and registration) must include a valid JWT token in the `Authorization` header.

```
Authorization: Bearer <your_token>
```

## User / Agent API

### Get Agent List
`GET /api/users/agents`

### Create User (Admin)
`POST /api/users`

### Register Agent (Admin)
`POST /api/users/agents`

## Chat API

### Get Chat History by Peer
`GET /api/chat/history/:peer_id`

### Reply Authorization Request
`POST /api/chat/auth/response`

## Dev Mock API (non-production + Admin)

### Reset Mock Data
`POST /api/dev/mock/reset`

### Insert Mock Chat Record
`POST /api/dev/mock/chat`

### Get Agent Token by Username
`GET /api/dev/mock/agent-token/:username`

## Message API

### Get Message History
`GET /api/messages`

### Send Message
`POST /api/messages`

## System API

### Check System Status
`GET /api/ping`
