# Research: Backend Directory Standardizing

## Decisions

### Decision: Project Layout - cmd/ & internal/
- **Decision**: Adopt the [standard Go project layout](https://github.com/golang-standards/project-layout).
- **Rationale**: 
    - `cmd/`: Contains the main entry point. Keeps the root clean and separates the binary building logic from the library logic.
    - `internal/`: Ensures that the core logic of EchoCenter cannot be imported by external modules (if it ever becomes a dependency), protecting the internal API.
    - Groups related functionality (Auth, DB, Handlers) into clear, discoverable packages.

### Decision: Package Path Updates
- **Decision**: Use the full module name `github.com/lea/echocenter/backend` for all internal imports.
- **Rationale**: Standard Go behavior. All sub-packages (e.g., `internal/auth`) must be imported using their full path from the module root.

### Decision: Resource Path Resolution
- **Decision**: Keep `.env` and `echocenter.db` paths relative to the execution root (the `backend/` directory).
- **Rationale**: 
    - When running `go run cmd/server/main.go` from the `backend/` directory, relative paths like `./echocenter.db` will still work.
    - `godotenv.Load()` by default looks in the current working directory. If the server is always started from the `backend/` root, no logic changes are needed.

## Best Practices

### Circular Dependency Avoidance
- Moving `models` to its own package (`internal/models`) is the first step to prevent circular dependencies, as almost every other package will need to import the models.
- Handlers will import `database`, `auth`, and `models`.
- Database will only import `models`.
- Auth will only import `models`.

### Test Migration
- Unit tests should be moved along with their corresponding files (e.g., `db_test.go` moves to `internal/database/`).
- Package names in test files must match the new sub-package name.
