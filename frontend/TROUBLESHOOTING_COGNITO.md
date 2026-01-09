# Troubleshooting: "This site can't be reached" Error

## Issue

You're seeing: `This site can't be reached` when trying to access:
```
https://saml-sso.dev.sectest.dcli.com.auth.us-east-1.amazoncognito.com/login
```

## Root Cause

The Cognito domain `saml-sso.dev.sectest.dcli.com` either:
1. ❌ Doesn't exist in Cognito
2. ❌ Isn't active/configured
3. ❌ Domain name in `.env.local` is incorrect
4. ❌ Domain was deleted or not created

## What's Missing - Checklist

### ✅ Step 1: Verify Cognito Domain Exists

**Check in AWS Console:**

1. Go to **AWS Console → Cognito → User Pools**
2. Select your User Pool
3. Go to **App integration → Domain**
4. **Check if domain exists:**
   - If you see a domain listed → Note the exact name
   - If you see "No domain" → You need to create one

**If domain doesn't exist:**

1. Click **Create Cognito domain** or **Actions → Create domain**
2. Choose domain type:
   - **Cognito domain** (recommended for testing): `your-unique-name`
   - **Custom domain** (requires certificate): `your-custom-domain.com`
3. Enter domain name (must be unique across all Cognito)
4. Click **Create domain**
5. Wait for status to show "Active"

### ✅ Step 2: Verify Domain Name in .env.local

**Check your `frontend/.env.local`:**

```env
NEXT_PUBLIC_COGNITO_DOMAIN=saml-sso.dev.sectest.dcli.com
```

**Common Mistakes:**
- ❌ Including `https://` prefix
- ❌ Including `.auth.us-east-1.amazoncognito.com` suffix
- ❌ Typo in domain name
- ❌ Using wrong domain

**Correct Format:**
```env
# ✅ Correct - Just the domain name
NEXT_PUBLIC_COGNITO_DOMAIN=your-unique-name

# ❌ Wrong - Don't include protocol
NEXT_PUBLIC_COGNITO_DOMAIN=https://your-unique-name

# ❌ Wrong - Don't include full URL
NEXT_PUBLIC_COGNITO_DOMAIN=your-unique-name.auth.us-east-1.amazoncognito.com
```

### ✅ Step 3: Test Domain Directly

**Try accessing the domain directly in browser:**

```
https://YOUR_DOMAIN.auth.us-east-1.amazoncognito.com
```

**Replace `YOUR_DOMAIN` with the actual domain from Cognito console.**

**Expected Result:**
- ✅ Should show Cognito login page
- ❌ "This site can't be reached" = Domain doesn't exist or isn't active

### ✅ Step 4: Verify All Cognito Configuration

**Check these in AWS Console:**

1. **User Pool exists** ✅
2. **App Client exists** ✅
3. **Domain exists and is Active** ❓ ← **CHECK THIS**
4. **Callback URLs configured** ✅
5. **OAuth flows enabled** ✅

## Quick Fix Steps

### Option 1: Create New Cognito Domain

1. **AWS Console → Cognito → User Pools → Your Pool**
2. **App integration → Domain**
3. **Create Cognito domain**:
   - Domain name: `inventory-dashboard-test` (or any unique name)
   - Click **Create domain**
4. **Wait for "Active" status**
5. **Update `.env.local`**:
   ```env
   NEXT_PUBLIC_COGNITO_DOMAIN=inventory-dashboard-test
   ```
6. **Restart dev server**

### Option 2: Use Existing Domain

If you have an existing domain:

1. **Get exact domain name** from Cognito console
2. **Update `.env.local`** with exact name
3. **Restart dev server**

### Option 3: Deploy Backend (Creates Domain Automatically)

If you deploy the backend, it creates the domain automatically:

```bash
cd backend
sam build
sam deploy --guided
```

The domain will be: `{StackName}-auth` (e.g., `aws-inventory-dashboard-auth`)

## Verification Steps

### 1. Check Domain Status

```bash
# Get your User Pool ID
USER_POOL_ID="us-east-1_xxxxxxxxx"

# List domains (via AWS CLI)
aws cognito-idp describe-user-pool-domain \
  --domain your-domain-name
```

### 2. Test Domain URL

Open in browser:
```
https://your-domain-name.auth.us-east-1.amazoncognito.com
```

Should show Cognito login page.

### 3. Check .env.local

```bash
cd frontend
cat .env.local | grep COGNITO_DOMAIN
```

Should show just the domain name (no protocol, no suffix).

### 4. Restart Dev Server

After any changes:
```bash
# Stop server (Ctrl+C)
npm run dev
```

## Common Issues & Solutions

### Issue 1: Domain Name Mismatch

**Symptom**: Domain in `.env.local` doesn't match Cognito

**Fix**: 
- Get exact domain from Cognito console
- Update `.env.local` with exact name
- Restart server

### Issue 2: Domain Not Active

**Symptom**: Domain exists but shows "Pending" or "Failed"

**Fix**:
- Wait a few minutes for activation
- Or delete and recreate domain
- Check CloudFormation events if deployed via SAM

### Issue 3: Domain Deleted

**Symptom**: Domain was deleted but `.env.local` still references it

**Fix**:
- Create new domain in Cognito
- Update `.env.local`
- Restart server

### Issue 4: Wrong Region

**Symptom**: Domain exists but in different region

**Fix**:
- Check region in Cognito console
- Update `NEXT_PUBLIC_COGNITO_REGION` in `.env.local`
- Or use domain from correct region

## Complete Setup Checklist

- [ ] Cognito User Pool created
- [ ] Cognito App Client created
- [ ] **Cognito Domain created and Active** ← **MOST IMPORTANT**
- [ ] Callback URLs include `http://localhost:3000/auth/callback`
- [ ] `.env.local` has correct `NEXT_PUBLIC_COGNITO_DOMAIN` (just name, no URL)
- [ ] `.env.local` has correct `NEXT_PUBLIC_COGNITO_REGION`
- [ ] Domain URL works when accessed directly
- [ ] Dev server restarted after `.env.local` changes

## Quick Test

1. **Get domain from Cognito console**
2. **Test in browser**: `https://{domain}.auth.{region}.amazoncognito.com`
3. **If it works** → Update `.env.local` and restart
4. **If it doesn't work** → Domain doesn't exist, create it

## Next Steps

1. ✅ **Check if domain exists** in Cognito console
2. ✅ **Create domain if missing**
3. ✅ **Update `.env.local`** with correct domain name
4. ✅ **Restart dev server**
5. ✅ **Test login again**

The most common issue is: **Domain doesn't exist or domain name in `.env.local` is incorrect**.

