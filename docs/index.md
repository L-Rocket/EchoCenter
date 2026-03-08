---
layout: home

hero:
  name: EchoCenter
  text: Documentation
  tagline: Modular and extensible intelligent agent management system
  actions:
    - theme: brand
      text: Get Started
      link: /architecture/overview
    - theme: alt
      text: GitHub
      link: https://github.com/L-Rocket/EchoCenter

features:
  - title: Core Agent Butler
    details: Responsible for coordinating agents and providing intelligent management.
  - title: Bilingual Workspace
    details: Built-in English / Simplified Chinese switch across dashboard, chat, and settings.
  - title: Real-time Communication
    details: Low-latency bidirectional messaging based on WebSocket.
  - title: Flexible Extension
    details: Easily integrate custom agents and external channels like Feishu.
---

## Quick Start

- [Architecture](/architecture/overview) - System architecture and components
- [API](/api/authentication) - API documentation
- [Agents](/agents/butler) - Agent documentation
- [Development](/development/setup) - Development guide
- [Feishu Integration](/development/feishu-integration) - Feishu connector onboarding and callback routing

## WebSocket Capacity Snapshot

- Latest validation (`2026-03-08`): `20,000 / 20,000` idle WebSocket long-connections passed (`100%`).
- Observed backend steady hold: RSS around `401MB~415MB`, threads around `29`.
- Analysis: current bottleneck for this scenario is not connection-carrying on backend, but usually load-generator ramp/source-port limits.
- Full method and notes: [Testing Guide](/development/testing#websocket-long-connection-capacity-c20k)
- Stress-tool code branch (kept separate): `feat/ws-c10k-stress-test`
