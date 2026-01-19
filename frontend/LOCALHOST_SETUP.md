# Localhost Testing Setup Guide

## Issue: "This site can't be reached" Error

If you're seeing a "This site can't be reached" error when trying to login, it's because:

1. **Cognito callback URLs need to include localhost**
2. **The callback route needs to be created** (✅ Done - see `src/app/auth/callback/page.tsx`)
3. **Cognito domain must be correctly configured**

## Step 1: Configure Cognito Callback URLs

### Option A: Update via AWS Console (Recommended)

1. Go to **AWS Console → Cognito → User Pools**
2. Select your User Pool
3. Go to **App integration → App client settings**
4. Find your app client (or create one)
5. Under **Hosted UI**, add these **Callback URLs**:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000
   ```
6. Under **Sign-out URLs**, add:
   ```
   http://localhost:3000
   ```
7. **Save changes**

### Option B: Update via AWS CLI

```bash
# Get your User Pool ID and Client ID
USER_POOL_ID="us-east-1_xxxxxxxxx"
CLIENT_ID="xxxxxxxxxxxxxxxxxxxxx"

# Update the app client
aws cognito-idp update-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --callback-urls "http://localhost:3000/auth/callback" "https://your-production-domain.com/auth/callback" \
  --logout-urls "http://localhost:3000" "https://your-production-domain.com" \
  --allowed-o-auth-flows "code" "implicit" \
  --allowed-o-auth-scopes "email" "openid" "profile" \
  --allowed-o-auth-flows-user-pool-client
```

### Option C: Update SAM Template (Before Deployment)

If you haven't deployed yet, update `backend/template.yaml`:

```yaml
CognitoUserPoolClient:
  Type: AWS::Cognito::UserPoolClient
  Properties:
    ClientName: AwsInventoryClient
    UserPoolId: !Ref CognitoUserPool
    GenerateSecret: false
    ExplicitAuthFlows:
      - ALLOW_USER_SRP_AUTH
      - ALLOW_REFRESH_TOKEN_AUTH
      - ALLOW_USER_PASSWORD_AUTH
    AllowedOAuthFlows:
      - code
      - implicit
    AllowedOAuthScopes:
      - email
      - openid
      - profile
    AllowedOAuthFlowsUserPoolClient: true
    CallbackURLs:
      - http://localhost:3000/auth/callback  # ✅ Add this
      - https://your-production-domain.com/auth/callback
    LogoutURLs:
      - http://localhost:3000  # ✅ Add this
      - https://your-production-domain.com
    SupportedIdentityProviders:
      - COGNITO
```

Then redeploy:
```bash
cd backend
sam build
sam deploy
```

## Step 2: Verify Your .env.local

Make sure your `frontend/.env.local` has the correct values:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain-name
```

**Important**: The `NEXT_PUBLIC_COGNITO_DOMAIN` should be just the domain name, NOT the full URL.

✅ Correct: `aws-inventory-dashboard-auth`
❌ Wrong: `https://aws-inventory-dashboard-auth.auth.us-east-1.amazoncognito.com`

## Step 3: Verify Cognito Domain

1. Go to **AWS Console → Cognito → User Pools**
2. Select your User Pool
3. Go to **App integration → Domain**
4. Verify the domain is active
5. Copy the domain name (without `.auth.region.amazoncognito.com`)

## Step 4: Test the Flow

1. **Start your dev server**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open browser**: `http://localhost:3000`

3. **Click "Sign In with SSO"**

4. **You should be redirected to**:
   ```
   https://your-domain.auth.us-east-1.amazoncognito.com/login?...
   ```

5. **After login, you'll be redirected back to**:
   ```
   http://localhost:3000/auth/callback?code=...
   ```

6. **The callback page will**:
   - Exchange the code for tokens
   - Store the session
   - Redirect to `/dashboard`

## Troubleshooting

### Error: "Invalid redirect_uri"

**Cause**: `http://localhost:3000/auth/callback` is not in Cognito's allowed callback URLs.

**Fix**: Add it to Cognito app client settings (see Step 1).

### Error: "This site can't be reached"

**Possible causes**:
1. Cognito domain is incorrect
2. Domain is not active
3. Network/firewall blocking Cognito

**Fix**:
- Verify domain in Cognito console
- Check `.env.local` has correct domain (without full URL)
- Try accessing the domain directly: `https://your-domain.auth.us-east-1.amazoncognito.com`

### Error: "Callback route not found"

**Cause**: The callback route doesn't exist.

**Fix**: ✅ Already created at `src/app/auth/callback/page.tsx`

### Error: "Failed to exchange authorization code"

**Possible causes**:
1. Code expired (codes expire quickly)
2. Redirect URI mismatch
3. Client ID mismatch

**Fix**:
- Ensure callback URL in Cognito matches exactly
- Verify client ID in `.env.local` matches Cognito
- Try logging in again (get a fresh code)

## Development Without Cognito (Mock Mode)

If you want to test the UI without Cognito, you can create a mock authentication:

1. Create `frontend/src/lib/auth-mock.ts` (optional)
2. Or temporarily bypass auth checks in components

However, for full functionality, you'll need Cognito configured.

## Quick Checklist

- [ ] Cognito User Pool created
- [ ] Cognito App Client created
- [ ] Callback URL `http://localhost:3000/auth/callback` added to Cognito
- [ ] Logout URL `http://localhost:3000` added to Cognito
- [ ] Cognito domain is active
- [ ] `.env.local` has correct values
- [ ] Callback route exists (`src/app/auth/callback/page.tsx`) ✅
- [ ] Dev server restarted after `.env.local` changes

## Next Steps

After setting up localhost:
1. Test the login flow
2. Verify callback works
3. Test dashboard access
4. When ready for production, add production callback URLs

## Production URLs

When deploying to production, add your production callback URLs:

```
https://your-domain.com/auth/callback
https://your-domain.com
```

Keep both localhost and production URLs in Cognito for flexibility.

