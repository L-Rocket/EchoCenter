# OpenHands Worker

This directory vendors the OpenHands worker used by EchoCenter's backend-managed ops agent.

It is intended to run as a separate service via the repository root `docker-compose.yml`.

Responsibilities:

- Accept `/run` requests from EchoCenter backend
- Materialize temporary SSH key files for runtime use
- Invoke OpenHands SDK with the requested task and available nodes
- Return a concise task summary back to EchoCenter

Notes:

- SSH private keys are never committed here; they are provided per request by the EchoCenter backend.
- The worker image installs the official OpenHands SDK directly from the upstream GitHub repository.
