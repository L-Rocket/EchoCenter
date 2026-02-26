# Research: Frontend Routing and Sidebar Refactor

## Decisions

### Decision: Routing Library - React Router (v6/v7)
- **Decision**: Use `react-router-dom`.
- **Rationale**: It is the industry standard for React applications. It provides excellent support for nested routes, layouts, and data loading (though we will focus on basic routing for this MVP). It ensures that navigation feels native to the browser (Back/Forward buttons work).

### Decision: Navigation Component - Shadcn Sidebar
- **Decision**: Use the modern `Sidebar` primitive from `shadcn@latest`.
- **Rationale**: Shadcn's sidebar is built on Radix UI, ensuring excellent accessibility (A11y), keyboard navigation, and built-in support for collapsible mobile views (collapsible/drawer patterns).
- **Alternatives**: Custom CSS Sidebar (too much maintenance overhead for a "beautiful" UI).

### Decision: Route Protection Strategy - Wrapper Component
- **Decision**: Use a `ProtectedRoute` component that checks `isAuthenticated` from `AuthContext`.
- **Rationale**: Simple, readable, and consistent with existing EchoCenter auth logic. It prevents unauthorized mounting of page components.

### Decision: Sidebar Content - Dynamic Navigation
- **Decision**: Define navigation items in a central config object.
- **Rationale**: Makes it easy to add new routes or change labels/icons in one place without touching the JSX tree multiple times.

## Best Practices

### Layout Separation
- Keep the `MainLayout` clean. Its only job is to provide the shell (Sidebar + Header + Content Area). Business logic belongs in the `pages/` directory.

### Performance
- Page transitions should be seamless. Since we are refactoring, we will ensure that components are correctly memoized if they rely on global state to prevent unnecessary re-renders during navigation.

### Accessibility (A11y)
- The sidebar MUST have proper ARIA labels and roles.
- Ensure the focus management works correctly when toggling the sidebar on mobile.
