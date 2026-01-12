# Verify Authentication - Step by Step Checklist

## Browser Console Diagnostic

Open your deployed site → Press F12 → Console → Run this:

```javascript
// Complete authentication diagnostic
(function() {
  console.log('=== AUTHENTICATION DIAGNOSTIC ===\n');
  
  // 1. Check localStorage
  console.log('1. localStorage Check:');
  try {
    const testKey = '__auth_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    console.log('   ✅ localStorage is available');
  } catch(e) {
    console.error('   ❌ localStorage blocked:', e.message);
  }
  
  // 2. Check session storage
  console.log('\n2. Session Storage Check:');
  const sessionStr = localStorage.getItem('aws-inventory-session');
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      console.log('   ✅ Session found:', {
        username: session.username,
        hasIdToken: !!session.idToken,
        hasAccessToken: !!session.accessToken,
        expiresAt: new Date(session.expiresAt).toISOString(),
        expiresIn: Math.round((session.expiresAt - Date.now()) / 1000 / 60) + ' minutes',
        valid: session.expiresAt > Date.now()
      });
    } catch(e) {
      console.error('   ❌ Session parse error:', e.message);
    }
  } else {
    console.log('   ⚠️ No session found in localStorage');
  }
  
  // 3. Check Cognito tokens (if using Cognito SDK)
  console.log('\n3. Cognito SDK Tokens:');
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
  if (clientId) {
    const cognitoKeys = Object.keys(localStorage).filter(k => 
      k.includes('CognitoIdentityServiceProvider') && k.includes(clientId)
    );
    if (cognitoKeys.length > 0) {
      console.log('   ✅ Cognito SDK tokens found:', cognitoKeys);
    } else {
      console.log('   ⚠️ No Cognito SDK tokens (using custom session storage)');
    }
  }
  
  // 4. Check environment variables
  console.log('\n4. Environment Variables:');
  console.log('   Cognito Domain:', process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '❌ MISSING');
  console.log('   Cognito Client ID:', process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ? '✅ SET' : '❌ MISSING');
  console.log('   Cognito Region:', process.env.NEXT_PUBLIC_COGNITO_REGION || '❌ MISSING');
  console.log('   API URL:', process.env.NEXT_PUBLIC_API_URL || '❌ MISSING');
  
  // 5. Check current URL
  console.log('\n5. Current URL:');
  console.log('   Full URL:', window.location.href);
  console.log('   Origin:', window.location.origin);
  console.log('   Pathname:', window.location.pathname);
  console.log('   Expected callback:', window.location.origin + '/auth/callback');
  
  // 6. Check URL parameters
  console.log('\n6. URL Parameters:');
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  console.log('   Code:', code ? '✅ YES' : '❌ NO');
  console.log('   Error:', error || 'None');
  
  // 7. Check redirect URI consistency
  console.log('\n7. Redirect URI Check:');
  const expectedRedirect = window.location.origin + '/auth/callback';
  const normalizedRedirect = expectedRedirect.replace(/\/$/, '');
  console.log('   Expected:', normalizedRedirect);
  console.log('   Has trailing slash?', expectedRedirect !== normalizedRedirect ? '⚠️ YES' : '✅ NO');
  
  console.log('\n=== END DIAGNOSTIC ===');
})();
```

## Step-by-Step Verification

### Step 1: Check Token Storage

**After logging in, check:**

1. **Browser DevTools** → **Application** → **Local Storage**
2. **Look for**: `aws-inventory-session` key
3. **Should contain**: JSON with `idToken`, `accessToken`, `expiresAt`, `username`

**If missing:**
- localStorage might be blocked
- Check browser privacy settings
- Check for browser extensions blocking storage

### Step 2: Verify redirect_uri Match

**In browser console, check:**

```javascript
// Get redirect URI used in login
const loginRedirect = window.location.origin + '/auth/callback';
console.log('Login redirect_uri:', loginRedirect);

// Get redirect URI used in token exchange (should be same)
const tokenRedirect = window.location.origin + '/auth/callback';
console.log('Token exchange redirect_uri:', tokenRedirect);

// Check if they match
console.log('Match:', loginRedirect === tokenRedirect ? '✅ YES' : '❌ NO');
```

**Must match EXACTLY** (including protocol, domain, path, no trailing slash)

### Step 3: Verify OAuth Flow

**Check Cognito configuration:**

```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-2_Cb4IW3we4 \
  --client-id 776457erti67mcbdlffj8idon6 \
  --query 'UserPoolClient.{OAuthEnabled:AllowedOAuthFlowsUserPoolClient,Flows:AllowedOAuthFlows,Callbacks:CallbackURLs}'
```

**Should show:**
- `OAuthEnabled: true`
- `Flows: ["authorization_code"]`
- `Callbacks` includes your domain

### Step 4: Test Authentication Flow

1. **Clear browser cache and localStorage**
2. **Visit your site**
3. **Open browser console (F12)**
4. **Watch for these logs in order:**

```
🏠 Home page mounted
🔐 loginWithHostedUI called
🔐 Redirect URI (normalized): https://your-domain.com/auth/callback
🔐 Redirecting to Cognito: ...
```

**After Cognito login:**
```
🔐 Auth Callback - Code received: YES
🔄 Starting token exchange...
🔐 Token exchange parameters:
  - Redirect URI: https://your-domain.com/auth/callback
  - Redirect URI must match login redirect_uri EXACTLY
✅ Token exchange successful!
✅ Session stored in localStorage
✅ Session verified in localStorage
🔄 Redirecting to dashboard...
📊 Dashboard layout mounted, checking session...
✅ Session found
✅ Valid session confirmed
```

### Step 5: Check for Redirect Loops

**If you see this pattern repeatedly:**
```
🏠 Home page mounted
🔄 No valid session, redirecting to Cognito...
🔐 Redirecting to Cognito: ...
[Redirects to Cognito]
[Back to home page]
🏠 Home page mounted
🔄 No valid session, redirecting to Cognito...
```

**This indicates:**
- Session not being stored
- Session not being read
- redirect_uri mismatch
- Token exchange failing

## Common Issues and Fixes

### Issue: "Session not found" after login

**Check:**
1. localStorage is available (run diagnostic)
2. Session was stored (check Application tab)
3. Session format is correct (should have `idToken`, `expiresAt`)

**Fix:**
- Check browser console for storage errors
- Verify localStorage is not blocked
- Check session expiration time

### Issue: "redirect_uri mismatch"

**Check:**
- Both login and token exchange use same redirect_uri
- No trailing slash differences
- Protocol matches (both https or both http)

**Fix:**
- Normalize redirect_uri (code already does this)
- Verify Cognito callback URLs match exactly

### Issue: "Token exchange failed"

**Check:**
- Authorization code is present in URL
- redirect_uri matches exactly
- Client ID is correct
- Cognito OAuth flows are enabled

**Fix:**
- Verify Cognito configuration
- Check browser console for error details
- Verify environment variables are set

## Quick Test Commands

### Test localStorage

```javascript
// In browser console
localStorage.setItem('test', 'test');
console.log('Stored:', localStorage.getItem('test'));
localStorage.removeItem('test');
console.log('localStorage works:', !localStorage.getItem('test'));
```

### Test Session Storage

```javascript
// In browser console
const session = localStorage.getItem('aws-inventory-session');
if (session) {
  const s = JSON.parse(session);
  console.log('Session valid:', s.expiresAt > Date.now());
  console.log('Has tokens:', !!s.idToken && !!s.accessToken);
} else {
  console.log('No session found');
}
```

### Test redirect_uri

```javascript
// In browser console
const uri1 = window.location.origin + '/auth/callback';
const uri2 = (window.location.origin + '/auth/callback').replace(/\/$/, '');
console.log('URI 1:', uri1);
console.log('URI 2:', uri2);
console.log('Match:', uri1 === uri2);
```

