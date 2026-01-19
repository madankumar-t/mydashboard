# Local Development Guide

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the `frontend/` directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values (or leave empty for local dev):

```env
# For local development without backend
NEXT_PUBLIC_API_URL=http://localhost:3000

# Leave empty for now (will show warnings but won't crash)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_CLIENT_ID=
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_DOMAIN=
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Common Issues

### Issue 1: Module Not Found Error

**Error**: `Module not found: Can't resolve '@/lib/auth'`

**Solution**: 
- ✅ Fixed! The path alias in `tsconfig.json` has been updated to `"@/*": ["./src/*"]`
- If you still see this error, restart the dev server:
  ```bash
  # Stop the server (Ctrl+C)
  # Delete .next folder
  rm -rf .next
  # Restart
  npm run dev
  ```

### Issue 2: Cognito Not Configured

**Warning**: `Cognito configuration missing`

**Solution**: 
- This is expected if you haven't set up Cognito yet
- The app will show a warning but won't crash
- For local development, you can:
  1. Leave Cognito empty (app will work but login won't function)
  2. Set up a local mock authentication
  3. Deploy backend first and get Cognito credentials

### Issue 3: API Connection Errors

**Error**: `Failed to fetch` or API errors

**Solution**:
- Make sure backend is running (if using local backend)
- Update `NEXT_PUBLIC_API_URL` in `.env.local`
- For local SAM backend: `http://localhost:3000`
- For deployed backend: `https://your-api.execute-api.region.amazonaws.com/prod`

## Development Without Backend

You can develop the frontend UI without the backend:

1. **Mock API Responses**: Create mock data in components
2. **Skip Authentication**: Comment out auth checks temporarily
3. **Use Static Data**: Hardcode sample data for testing UI

## Development With Backend

### Option 1: Local SAM Backend

```bash
# Terminal 1: Start SAM local
cd backend
sam local start-api

# Terminal 2: Start Next.js
cd frontend
npm run dev
```

Update `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Option 2: Deployed Backend

1. Deploy backend first (see `DEPLOYMENT.md`)
2. Get API URL from CloudFormation outputs
3. Update `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://your-api.execute-api.region.amazonaws.com/prod
```

## TypeScript Errors

If you see TypeScript errors:

```bash
# Check for type errors
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## Next Steps

1. ✅ Fix path alias issue (done)
2. ⏳ Set up Cognito (after backend deployment)
3. ⏳ Configure API URL (after backend deployment)
4. ⏳ Test authentication flow
5. ⏳ Test dashboard functionality

## Troubleshooting

### Clear Next.js Cache

```bash
rm -rf .next
npm run dev
```

### Reinstall Dependencies

```bash
rm -rf node_modules package-lock.json
npm install
```

### Check Node Version

```bash
node --version  # Should be 18+
```

### Check TypeScript Config

Make sure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Need Help?

- Check `README.md` for project overview
- Check `DEPLOYMENT.md` for backend setup
- Check `ARCHITECTURE.md` for system design

