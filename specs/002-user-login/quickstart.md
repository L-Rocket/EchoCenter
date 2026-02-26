# Quickstart: User Login

## Backend Configuration
1. Create or update `.env` in the `backend/` directory:
   ```env
   JWT_SECRET=your-very-secret-key
   INITIAL_ADMIN_USER=admin
   INITIAL_ADMIN_PASS=admin123
   ```
2. Restart the backend. It will automatically create the `admin` user if the database is empty.

## Login Verification (via curl)
```bash
# 1. Login to get token
curl -X POST http://localhost:8080/api/auth/login 
     -H "Content-Type: application/json" 
     -d '{"username": "admin", "password": "admin123"}'

# 2. Use the token to access messages (replace <token> with actual output)
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/messages
```

## Frontend Access
1. Open the dashboard. You should be redirected to `/login`.
2. Enter the initial admin credentials.
3. Upon success, you will see the message dashboard.
