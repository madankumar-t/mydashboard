# Verify Cognito Configuration for Localhost

## Quick Verification Steps

### 1. Check Your .env.local

```bash
cd frontend
cat .env.local
```

Should have:
```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain-name  # ← Just the domain name, not full URL
```

### 2. Test Cognito Domain

Open in browser:
```
https://YOUR_DOMAIN.auth.us-east-1.amazoncognito.com
```

Should show Cognito login page (not "site can't be reached").

### 3. Verify Callback URLs in Cognito

**AWS Console**:
1. Cognito → User Pools → Your Pool
2. App integration → App client settings
3. Check "Callback URLs" includes:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000`

### 4. Test the Flow

1. Start dev server: `npm run dev`
2. Open: `http://localhost:3000`
3. Click "Sign In with SSO"
4. Should redirect to Cognito (not show "can't be reached")
5. After login, should redirect back to `/auth/callback`
6. Should then redirect to `/dashboard`

## Common Issues

### Issue: Domain shows "can't be reached"

**Check**:
- Domain is active in Cognito console
- Domain name in `.env.local` is correct (no `https://` or `.auth.region.amazoncognito.com`)
- Network/firewall allows access to Cognito

### Issue: "Invalid redirect_uri"

**Fix**: Add `http://localhost:3000/auth/callback` to Cognito callback URLs.

### Issue: Callback page not found

**Fix**: ✅ Already created at `src/app/auth/callback/page.tsx`

## Debug Mode

Add to your code temporarily to see what's happening:

```typescript
// In auth.ts, add console.log
console.log('Cognito Domain:', cognitoDomain)
console.log('Client ID:', clientId)
console.log('Redirect URI:', redirectUri)
console.log('Login URL:', cognitoLoginUrl)
```

Check browser console for these values.

