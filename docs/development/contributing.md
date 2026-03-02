# Contributing Guide

## Overview

Welcome to contributing to EchoCenter! This document describes how to participate in project development.

## Development Process

### 1. Fork the Repository
Click the "Fork" button on GitHub.

### 2. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/EchoCenter.git
cd EchoCenter
```

### 3. Add Upstream Remote
```bash
git remote add upstream https://github.com/L-Rocket/EchoCenter.git
```

### 4. Create a Branch
```bash
git checkout -b feature/your-feature
# or
git checkout -b fix/your-fix
```

### 5. Develop
Perform your development work.

### 6. Commit
```bash
git add .
git commit -m "feat: add your feature"
# or
git commit -m "fix: fix your bug"
```

### 7. Push
```bash
git push origin feature/your-feature
```

### 8. Create a Pull Request
Create a Pull Request on GitHub.

> **Important**: Do not commit directly to `main`. Always work in a feature/fix/docs branch and open a PR. You can enable branch protection in GitHub Settings → Branches to require PR reviews and passing checks before merging.

### 8. Continuous Integration

Every Pull Request automatically triggers a CI workflow that runs:
- Backend: `go vet` and `go test`
- Frontend: `eslint` and `vitest`

Please ensure your tests pass locally by running `make lint` and `make test` before pushing.

## Code Standards

### Go Code Standards
- Use `gofmt` to format code.
- Follow Go naming conventions.
- Add comments.
- Use error handling.

### Python Code Standards
- Use `black` to format code.
- Follow PEP 8.
- Add type hints.
- Use docstrings.

### JavaScript/TypeScript Code Standards
- Use `prettier` to format code.
- Follow Airbnb JavaScript Style Guide.
- Add comments.
- Use TypeScript.

## Commit Message Convention

### Format
```
<type>: <description>

[optional body]

[optional footer]
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code format
- `refactor` - Refactoring
- `test` - Testing
- `chore` - Build process or auxiliary tool changes

### Examples
```
feat: add new agent type

This adds support for new agent types.

Closes #123
```

```
fix: resolve login issue

Fixed the login issue where users couldn't login with special characters.

Fixes #456
```

```
docs: add contribution guide

Added detailed guide for contributors.
```

## Pull Request

### PR Title
```
feat: add new feature
fix: fix bug
docs: update documentation
```

### PR Description
```
## Description
Describe your changes.

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactor

## Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Screenshots (if applicable)
Add screenshots if applicable.

## Checklist
- [ ] Code follows project style
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No warnings or errors
```

## Code Review

### Review Criteria
1. **Code Quality**: Is the code clear? Does it follow standards? Are there comments?
2. **Functionality**: Is the function correct? Are there edge cases? Is there error handling?
3. **Performance**: Are there performance issues? Memory leaks? Resource leaks?
4. **Security**: Are there security issues? Sensitive information leaks? Input validation?

### Review Process
1. Submit PR.
2. Code review.
3. Modify code.
4. Resubmit.
5. Merge PR.

## Issue Tracking

### Suggested First Issues / PRs

If you want to make your first contribution, here are some low-risk ideas:

- Improve docs wording or add missing examples.
- Add or refine unit tests for uncovered logic.
- Fix typos, broken links, or inconsistent naming.
- Add small developer-experience improvements (scripts, Makefile targets, validation checks).

Recommended labels for maintainers:
- `good first issue`
- `documentation`
- `tests`
- `help wanted`

### Create an Issue
Use GitHub Issues to create issues.

### Issue Template
```
## Description
Describe the issue.

## Steps to Reproduce
1. Go to ...
2. Click on ...
3. See error

## Expected Behavior
Describe what you expected.

## Actual Behavior
Describe what actually happened.

## Environment
- OS: ...
- Browser: ...
- Version: ...

## Screenshots
Add screenshots if applicable.

## Additional Context
Add any additional context.
```

## License
By contributing, you agree that your contribution follows the MIT License.

## Recognition
Thanks to all contributors!
