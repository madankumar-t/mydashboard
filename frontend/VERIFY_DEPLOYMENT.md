# Verify Your Deployment - Step by Step

## Before You Start

Make sure you've done these in order:

1. ✅ Set environment variables
2. ✅ Rebuilt the code (`npm run build:static`)
3. ✅ Deployed to S3 (`aws s3 sync out/ s3://bucket --delete`)
4. ✅ Invalidated CloudFront cache

## Quick Verification Commands

### 1. Check if Build Contains Your Variables

```bash
cd frontend

# After building, search for your Cognito domain in the build
grep -r "your-cognito-domain-name" out/_next/static/ | head -1

# If you see results, variables are embedded ✅
# If no results, variables weren't set during build ❌
```

### 2. Check S3 Contents

```bash
# List files in S3 bucket
aws s3 ls s3://your-bucket-name/ --recursive | head -20

# Should see:
# - index.html
# - _next/static/...
# - auth/callback/index.html (or similar)
```

### 3. Check CloudFront Distribution

```bash
# Get distribution details
aws cloudfront get-distribution-config \
  --id YOUR_DIST_ID \
  --query 'DistributionConfig.{Status:Status,ErrorPages:CustomErrorResponses.Items}'
```

### 4. Check Cognito Configuration

```bash
# Get callback URLs
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-2_Cb4IW3we4 \
  --client-id 776457erti67mcbdlffj8idon6 \
  --query 'UserPoolClient.{CallbackURLs:CallbackURLs,AllowedOAuthFlows:AllowedOAuthFlows}'
```

## Browser Console Diagnostic

**Open your deployed site → Press F12 → Console → Paste this:**

```javascript
// Complete diagnostic
console.log('=== DEPLOYMENT VERIFICATION ===');
console.log('1. Current URL:', window.location.href);
console.log('2. Origin:', window.location.origin);
console.log('3. Cognito Domain:', process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '❌ MISSING');
console.log('4. Cognito Client ID:', process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ? '✅ SET' : '❌ MISSING');
console.log('5. Cognito Region:', process.env.NEXT_PUBLIC_COGNITO_REGION || '❌ MISSING');
console.log('6. API URL:', process.env.NEXT_PUBLIC_API_URL || '❌ MISSING');

// Check localStorage
try {
  const session = localStorage.getItem('aws-inventory-session');
  console.log('7. Session stored:', session ? '✅ YES' : '❌ NO');
  if (session) {
    const s = JSON.parse(session);
    console.log('   - Username:', s.username);
    console.log('   - Expires:', new Date(s.expiresAt).toISOString());
    console.log('   - Valid:', s.expiresAt > Date.now() ? '✅ YES' : '❌ EXPIRED');
  }
} catch(e) {
  console.log('7. Session check failed:', e);
}

// Check localStorage availability
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
  console.log('8. localStorage available: ✅ YES');
} catch(e) {
  console.log('8. localStorage available: ❌ NO -', e.message);
}

console.log('=== END VERIFICATION ===');
```

## What to Look For

### ✅ Good Signs:
- Cognito Domain shows your actual domain (not "MISSING")
- Cognito Client ID shows "SET"
- localStorage available: YES
- Session stored: YES (after authentication)

### ❌ Bad Signs:
- Any "MISSING" values → Environment variables not set at build time
- localStorage available: NO → Browser blocking storage
- Session stored: NO (after auth) → Session not being saved

## If You See "MISSING" Values

**This means environment variables weren't set during build.**

**Fix:**
```bash
cd frontend

# Set ALL variables
export NEXT_PUBLIC_COGNITO_DOMAIN="your-domain-name"
export NEXT_PUBLIC_COGNITO_CLIENT_ID="776457erti67mcbdlffj8idon6"
export NEXT_PUBLIC_COGNITO_USER_POOL_ID="us-east-2_Cb4IW3we4"
export NEXT_PUBLIC_COGNITO_REGION="us-east-2"
export NEXT_PUBLIC_API_URL="https://your-api.execute-api.region.amazonaws.com/prod"
export NEXT_EXPORT=true

# Rebuild
npm run build:static

# Verify variables are now in build
grep -r "your-domain-name" out/_next/static/ | head -1

# Redeploy
aws s3 sync out/ s3://your-bucket --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Test Authentication Flow

1. **Clear browser cache and cookies**
2. **Visit your CloudFront URL**
3. **Open browser console (F12)**
4. **Watch for these logs in order:**

```
🏠 Home page mounted
🔐 loginWithHostedUI called
🔐 Cognito Config: { domain: "your-domain", ... }
🔐 Redirecting to Cognito: ...
```

5. **After Cognito login:**
```
🔐 Auth Callback - Code received: YES
🔄 Starting token exchange...
✅ Token exchange successful!
✅ Session stored in localStorage
🔄 Redirecting to dashboard...
📊 Dashboard layout mounted, checking session...
✅ Session found
✅ Valid session confirmed
```

6. **If you see errors, note them and check the troubleshooting guide**

