# Quick Diagnostic: What's Missing?

## Current Error

```
This site can't be reached
https://saml-sso.dev.sectest.dcli.com.auth.us-east-1.amazoncognito.com/login
```

## Most Likely Issue

**The Cognito domain `saml-sso.dev.sectest.dcli.com` doesn't exist or isn't active.**

## Quick Check (30 seconds)

### 1. Check Your .env.local

```bash
cd frontend
cat .env.local
```

Look for:
```env
NEXT_PUBLIC_COGNITO_DOMAIN=saml-sso.dev.sectest.dcli.com
```

### 2. Test Domain Directly

Open in browser:
```
https://saml-sso.dev.sectest.dcli.com.auth.us-east-1.amazoncognito.com
```

**If you see "This site can't be reached"** → Domain doesn't exist
**If you see Cognito login page** → Domain exists, check other config

### 3. Check Cognito Console

1. AWS Console → Cognito → User Pools
2. Select your User Pool
3. App integration → Domain
4. **Does the domain `saml-sso.dev.sectest.dcli.com` exist?**

## Quick Fix

### If Domain Doesn't Exist:

1. **Create new domain** in Cognito console
2. **Use a simple name** like: `inventory-dashboard-test`
3. **Update `.env.local`**:
   ```env
   NEXT_PUBLIC_COGNITO_DOMAIN=inventory-dashboard-test
   ```
4. **Restart dev server**

### If Domain Exists:

1. **Verify exact domain name** in Cognito console
2. **Update `.env.local`** with exact name (no `https://`, no `.auth.region.amazoncognito.com`)
3. **Restart dev server**

## What You Need

1. ✅ Cognito User Pool
2. ✅ Cognito App Client  
3. ❌ **Cognito Domain (MISSING or INCORRECT)** ← **THIS IS THE ISSUE**
4. ✅ Callback URLs configured
5. ✅ `.env.local` file

## Most Common Problems

1. **Domain doesn't exist** → Create it
2. **Domain name typo in .env.local** → Fix it
3. **Domain not active** → Wait or recreate
4. **Wrong region** → Check region matches

## One-Minute Fix

```bash
# 1. Go to Cognito console and create domain
# 2. Get the domain name (e.g., "inventory-test")

# 3. Update .env.local
cd frontend
# Edit .env.local and set:
# NEXT_PUBLIC_COGNITO_DOMAIN=inventory-test

# 4. Restart
npm run dev
```

The domain is the missing piece!

