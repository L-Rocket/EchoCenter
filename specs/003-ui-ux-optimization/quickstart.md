# Quickstart: UI/UX Optimization

## Setup Instructions
1. **Initialize Shadcn/ui**:
   ```bash
   cd frontend
   npx shadcn@latest init
   ```
2. **Add Required Primitives**:
   ```bash
   npx shadcn@latest add card badge button scroll-area
   ```
3. **Install Icons**:
   ```bash
   npm install lucide-react
   ```

## Development Workflow
- **Standard Card**: Use the `Card` component for all message listings.
- **Color Consistency**: Always use semantic Tailwind classes (`bg-primary`, `text-muted-foreground`) instead of hardcoded hex values.
- **Review**: Resize your browser to 375px (mobile) after any layout change to ensure responsiveness.

## Visual Verification
- Open the dashboard.
- Confirm the background is Slate-50.
- Confirm the header is sticky and shadows are consistent.
- Confirm agent messages use the new `Card` and `Badge` components.
