# Quickstart: Dark and Light Mode Toggle

## Testing the Theme Toggle

1. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```
2. Open the application in your browser (typically `http://localhost:5173`).
3. Log in (if authentication is active) and observe the `MainLayout` header.
4. **Toggle the Theme**: Look for the Sun/Moon icon button in the top-right corner of the header. Click it to open the dropdown menu or toggle directly.
5. **Verify Visuals**: Ensure the background, text, and components (like the sidebar) correctly switch colors based on the `frontend/src/index.css` variables.
6. **Verify Persistence**: Refresh the browser page. The application should remember the last selected theme and apply it immediately without a flash of the opposite theme.
7. **Verify System Preference**: Set the toggle to "System". Change your operating system's appearance setting (e.g., in macOS Settings -> Appearance) between Light and Dark. The application should automatically respond to the OS change.
