# Feature Specification: User Login

**Feature Branch**: `001-user-login`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "添加新功能，给我的前端界面添加登录功能，后端也要支持登录"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Authentication (Priority: P1)

As an EchoCenter operator, I want to log in using a username and password so that I can access the monitoring dashboard securely.

**Why this priority**: Fundamental security gate. Without login, anyone can view the agent statuses.

**Independent Test**: Can be tested by visiting the login page, entering correct credentials, and being redirected to the dashboard.

**Acceptance Scenarios**:

1. **Given** I am on the login page, **When** I enter a valid username and password, **Then** I am redirected to the dashboard and my session is established.
2. **Given** I am on the login page, **When** I enter an invalid password, **Then** I see an "Invalid credentials" error message and remain on the login page.
3. **Given** I am an unauthenticated user, **When** I attempt to access the dashboard directly, **Then** I am redirected to the login page.
4. **Given** I am the system administrator, **When** the system starts for the first time, **Then** I can log in using the credentials provided in the environment variables (`INITIAL_ADMIN_USER`, `INITIAL_ADMIN_PASS`).

---

### User Story 2 - User Management (Priority: P2)

As a system administrator, I want to create other users from within the dashboard so that I can grant access to team members without allowing public self-registration.

**Why this priority**: Supports team collaboration while maintaining strict access control.

**Independent Test**: Log in as admin, navigate to a "User Management" section, create a new user, and verify that the new user can log in.

**Acceptance Scenarios**:

1. **Given** I am logged in as an administrator, **When** I provide a username and password for a new member, **Then** a new user account is created and stored securely.
2. **Given** the login page, **When** a random visitor arrives, **Then** they see no "Sign Up" or self-registration options.

---

### User Story 3 - Secure Session Management (Priority: P2)

As a logged-in user, I want the system to remember my authenticated state for 24 hours so that I don't have to log in repeatedly during a single day of monitoring.

**Why this priority**: Essential for usability.

**Independent Test**: After logging in, refresh the dashboard or navigate away and back; the session should persist without re-login for up to 24 hours.

**Acceptance Scenarios**:

1. **Given** I have successfully logged in, **When** I refresh the browser, **Then** I remain authenticated and the dashboard continues to display messages.
2. **Given** 24 hours have passed since my last login, **When** I attempt to fetch new messages, **Then** the backend returns an unauthorized error and the frontend redirects me to the login page.

---

### User Story 4 - Secure Logout (Priority: P3)

As a logged-in user, I want to be able to log out of the system so that my session is terminated and no one else can access the dashboard from my device.

**Why this priority**: Basic security hygiene.

**Independent Test**: Click a "Logout" button and verify that navigating back to the dashboard requires re-authentication.

**Acceptance Scenarios**:

1. **Given** I am logged in, **When** I click the "Logout" button, **Then** my session is cleared both on the frontend and backend, and I am redirected to the login page.

---

### Edge Cases

- **Brute Force**: Multiple failed login attempts should be logged for monitoring.
- **Token Tampering**: If a session token is manually altered in the browser, the backend must reject it and the user must be logged out.
- **Empty Credentials**: Frontend and backend validation for mandatory username and password fields.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Login page with username and password fields.
- **FR-002**: Backend MUST verify credentials against stored user data using secure password hashing (e.g., bcrypt).
- **FR-003**: System MUST issue a signed JWT (JSON Web Token) with a 24-hour expiration upon successful login.
- **FR-004**: Frontend MUST store the JWT and include it in the `Authorization: Bearer <token>` header for all API requests.
- **FR-005**: Backend MUST implement middleware to validate the JWT for all `/api/messages` and `/api/users` endpoints.
- **FR-006**: System MUST provide a Logout mechanism that invalidates the local session storage.
- **FR-007**: Backend MUST initialize an admin user at startup using `INITIAL_ADMIN_USER` and `INITIAL_ADMIN_PASS` environment variables if no users exist.
- **FR-008**: System MUST provide an "Invite User" interface accessible only to the primary administrator to create additional users.

### Key Entities *(include if feature involves data)*

- **User**: Represents an authorized operator.
  - `ID`: Unique identifier.
  - `Username`: Login name.
  - `PasswordHash`: Securely hashed password.
  - `Role`: (e.g., ADMIN, MEMBER) to distinguish between who can invite others.
- **Session (JWT)**: Represents an active authentication state.
  - `Subject`: User ID.
  - `ExpiresAt`: 24 hours from issuance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Unauthorized access to dashboard APIs returns a `401 Unauthorized` status 100% of the time.
- **SC-002**: Login process (from submit to dashboard load) completes in under 1 second.
- **SC-003**: Passwords in the database are stored using a slow-hashing algorithm, never in plain text.
- **SC-004**: Session tokens expire and are rejected by the backend exactly 24 hours after issuance.

## Assumptions

- **A-001**: We will use JWT for stateless authentication as it avoids backend session storage in the MVP.
- **A-002**: HTTPS is required for secure transmission of the JWT.
- **A-003**: For the MVP, user management is restricted to the administrator creating new members (no deletion/editing yet).
