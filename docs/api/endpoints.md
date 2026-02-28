# API Endpoints

## Overview

EchoCenter provides a set of RESTful API endpoints for managing users, agents, and messages.

## Authentication

All API requests (except for login and registration) must include a valid JWT token in the `Authorization` header.

```
Authorization: Bearer <your_token>
```

## User API

### Get User List
`GET /api/users`

### Get User Details
`GET /api/users/:id`

### Register Agent
`POST /api/users/agents`

### Delete Agent
`DELETE /api/users/agents/:id`

## Message API

### Get Message History
`GET /api/messages`

### Send Message
`POST /api/messages`

## System API

### Check System Status
`GET /api/ping`
