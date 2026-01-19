# Frontend Deployment Guide

## Quick Setup

### Step 1: Create Environment File

Create `.env.local` file in the `frontend/` directory:

```bash
cd frontend
cp .env.local.example .env.local
```

### Step 2: Update Environment Variables

Edit `.env.local` with your backend deployment outputs:

```env
# Backend API URL (from CloudFormation output)
NEXT_PUBLIC_API_URL=https://x8jz28ttug.execute-api.us-east-2.amazonaws.com/prod

# Cognito Configuration (from CloudFormation outputs)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-2_Cb4IW3we4
NEXT_PUBLIC_COGNITO_CLIENT_ID=776457erti67mcbdlffj8idon6
NEXT_PUBLIC_COGNITO_REGION=us-east-2

# Cognito Domain (get from your existing Cognito User Pool)
# See instructions below to find this
NEXT_PUBLIC_COGNITO_DOMAIN=your-cognito-domain-name
```

### Step 3: Get Cognito Domain Name

Since you're using an existing Cognito User Pool, get the domain name:

**Option 1: AWS Console**
1. Go to AWS Console → Cognito → User Pools
2. Select your User Pool: `us-east-2_Cb4IW3we4`
3. Go to **App integration** tab
4. Scroll to **Domain** section
5. Copy the domain name (e.g., `saml-sso.dev.sectest.dcli.com`)
   - **Important**: Use just the domain name, NOT the full URL
   - ✅ Correct: `saml-sso.dev.sectest.dcli.com`
   - ❌ Wrong: `https://saml-sso.dev.sectest.dcli.com.auth.us-east-2.amazoncognito.com`

**Option 2: AWS CLI**
```bash
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-2_Cb4IW3we4 \
  --region us-east-2 \
  --query 'UserPool.Domain'
```

### Step 4: Verify Cognito App Client Settings

Ensure your existing Cognito App Client has:

1. **OAuth 2.0 Settings**:
   - ✅ Authorization code grant
   - ✅ Implicit grant
   - ✅ Allowed scopes: `email`, `openid`, `profile`

2. **Callback URLs**:
   - ✅ `http://localhost:3000/auth/callback` (for local dev)
   - ✅ `http://localhost:3000` (for local dev)
   - ✅ Your production domain callback URL

3. **Sign-out URLs**:
   - ✅ `http://localhost:3000` (for local dev)
   - ✅ Your production domain

**To update in AWS Console:**
1. Cognito → User Pools → Your Pool → App integration
2. Click on your App Client
3. Edit **Hosted UI** settings
4. Add callback and sign-out URLs

### Step 5: Test Locally

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` and test:
- ✅ Login redirects to Cognito Hosted UI
- ✅ Authentication callback works
- ✅ Dashboard loads
- ✅ API calls succeed

## Production Deployment

### Option 1: S3 + CloudFront (AWS Native) ⭐ Recommended for AWS

See **[FRONTEND_S3_CLOUDFRONT_DEPLOYMENT.md](./FRONTEND_S3_CLOUDFRONT_DEPLOYMENT.md)** for complete guide.

**Quick Deploy:**
```bash
cd frontend
npm install
npm run build:static
aws s3 sync out/ s3://aws-inventory-dashboard-frontend --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

**Windows (PowerShell):**
```powershell
cd frontend
.\deploy.ps1 -BucketName "aws-inventory-dashboard-frontend" -DistributionId "YOUR_DIST_ID"
```

### Option 2: Vercel

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   cd frontend
   vercel
   ```

3. **Set Environment Variables** in Vercel Dashboard:
   - Go to Project Settings → Environment Variables
   - Add all `NEXT_PUBLIC_*` variables from `.env.local`

4. **Update Cognito Callback URLs**:
   - Add your Vercel domain to Cognito App Client callback URLs
   - Example: `https://your-app.vercel.app/auth/callback`

### Option 2: AWS Amplify

1. **Connect Repository**:
   - Go to AWS Amplify Console
   - Connect your Git repository

2. **Build Settings**:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - cd frontend
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: frontend
       files:
         - '**/*'
   ```

3. **Environment Variables**:
   - Add all `NEXT_PUBLIC_*` variables in Amplify Console

4. **Update Cognito Callback URLs**:
   - Add Amplify domain to Cognito App Client

### Option 3: Docker / Self-Hosted

1. **Build Docker Image**:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY frontend/package*.json ./
   RUN npm install
   COPY frontend/ .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Set Environment Variables**:
   ```bash
   docker run -p 3000:3000 \
     -e NEXT_PUBLIC_API_URL=... \
     -e NEXT_PUBLIC_COGNITO_USER_POOL_ID=... \
     -e NEXT_PUBLIC_COGNITO_CLIENT_ID=... \
     -e NEXT_PUBLIC_COGNITO_REGION=... \
     -e NEXT_PUBLIC_COGNITO_DOMAIN=... \
     your-image
   ```

## Files to Update

### Required: `.env.local` (for local development)

**Location**: `frontend/.env.local`

**Contents**:
```env
NEXT_PUBLIC_API_URL=https://x8jz28ttug.execute-api.us-east-2.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-2_Cb4IW3we4
NEXT_PUBLIC_COGNITO_CLIENT_ID=776457erti67mcbdlffj8idon6
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain-name
```

### Optional: `next.config.js` (already configured)

The `next.config.js` file already reads from environment variables, so no changes needed unless you want to override defaults.

## Verification Checklist

After configuration, verify:

- [ ] `.env.local` file exists in `frontend/` directory
- [ ] All environment variables are set (no empty values)
- [ ] Cognito domain name is correct (just the name, not full URL)
- [ ] Cognito App Client has correct callback URLs
- [ ] Backend API URL is accessible
- [ ] Local dev server starts without errors
- [ ] Login redirects to Cognito Hosted UI
- [ ] Authentication callback works
- [ ] Dashboard loads and shows data

## Troubleshooting

### Issue: "Cognito configuration missing"

**Solution**:
- Check `.env.local` file exists
- Verify all variables are set
- Restart dev server after changes

### Issue: "This site can't be reached" (Cognito domain)

**Solution**:
- Verify domain name is correct (just the name, not full URL)
- Check domain exists in your Cognito User Pool
- Ensure domain is active

### Issue: "Invalid redirect URI"

**Solution**:
- Add `http://localhost:3000/auth/callback` to Cognito App Client callback URLs
- For production, add your production domain

### Issue: API calls failing

**Solution**:
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check API Gateway is deployed and accessible
- Verify CORS is configured in backend
- Check browser console for specific errors

## Next Steps

1. ✅ Create `.env.local` with your values
2. ✅ Get Cognito domain name
3. ✅ Update Cognito App Client callback URLs
4. ✅ Test locally with `npm run dev`
5. ✅ Deploy to production (Vercel, Amplify, or self-hosted)

## Summary

**Files to Update:**
- ✅ `frontend/.env.local` - **REQUIRED** (create this file)

**Files Already Configured:**
- ✅ `frontend/next.config.js` - Reads from environment variables
- ✅ `frontend/src/lib/api.ts` - Uses `NEXT_PUBLIC_API_URL`
- ✅ `frontend/src/lib/auth.ts` - Uses Cognito environment variables

**No Code Changes Needed** - Just update environment variables!

