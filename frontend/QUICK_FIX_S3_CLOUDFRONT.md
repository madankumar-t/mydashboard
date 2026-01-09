# Quick Fix: Redirect Loop in S3/CloudFront

## Most Likely Cause: Environment Variables Not Set at Build Time

If it works locally but not in production, **90% of the time** it's because environment variables weren't set during the build.

## Quick Fix Steps

### Step 1: Set Environment Variables and Rebuild

```bash
cd frontend

# Set ALL environment variables (replace with your actual values)
export NEXT_PUBLIC_API_URL="https://your-api.execute-api.region.amazonaws.com/prod"
export NEXT_PUBLIC_COGNITO_USER_POOL_ID="us-east-1_xxxxx"
export NEXT_PUBLIC_COGNITO_CLIENT_ID="xxxxx"
export NEXT_PUBLIC_COGNITO_REGION="us-east-1"
export NEXT_PUBLIC_COGNITO_DOMAIN="your-domain-name"  # Just the domain name, no https://
export NEXT_EXPORT=true

# Verify variables are set
echo "API URL: $NEXT_PUBLIC_API_URL"
echo "Cognito Domain: $NEXT_PUBLIC_COGNITO_DOMAIN"
echo "Cognito Client ID: $NEXT_PUBLIC_COGNITO_CLIENT_ID"

# Rebuild
npm run build:static
```

### Step 2: Verify Build Contains Variables

```bash
# Check if variables are embedded in the build
grep -r "NEXT_PUBLIC_COGNITO_DOMAIN" out/_next/static/ | head -1
# Should show your domain, not empty string
```

### Step 3: Redeploy to S3

```bash
# Upload to S3
aws s3 sync out/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Step 4: Verify CloudFront Error Pages

**Using AWS Console:**
1. CloudFront → Your Distribution → Error Pages
2. **403 Forbidden**: Response Page = `/index.html`, Response Code = `200`
3. **404 Not Found**: Response Page = `/index.html`, Response Code = `200`

### Step 5: Verify Cognito Callback URL

```bash
# Get your CloudFront domain
CLOUDFRONT_DOMAIN="d1234567890.cloudfront.net"  # Replace with your actual domain

# Update Cognito callback URLs
aws cognito-idp update-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --callback-urls \
    "https://${CLOUDFRONT_DOMAIN}/auth/callback" \
    "https://${CLOUDFRONT_DOMAIN}"
```

## Windows PowerShell Version

```powershell
cd frontend

# Set environment variables
$env:NEXT_PUBLIC_API_URL="https://your-api.execute-api.region.amazonaws.com/prod"
$env:NEXT_PUBLIC_COGNITO_USER_POOL_ID="us-east-1_xxxxx"
$env:NEXT_PUBLIC_COGNITO_CLIENT_ID="xxxxx"
$env:NEXT_PUBLIC_COGNITO_REGION="us-east-1"
$env:NEXT_PUBLIC_COGNITO_DOMAIN="your-domain-name"
$env:NEXT_EXPORT="true"

# Verify
Write-Host "API URL: $env:NEXT_PUBLIC_API_URL"
Write-Host "Cognito Domain: $env:NEXT_PUBLIC_COGNITO_DOMAIN"

# Build
npm run build:static

# Deploy
aws s3 sync out/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Test After Fix

1. **Clear browser cache and cookies**
2. **Visit your CloudFront URL**
3. **Open browser console (F12)**
4. **Check for errors** - Should see:
   - ✅ `🔐 Cognito Config:` with your domain
   - ✅ `🔐 Redirecting to Cognito:`
   - ❌ No "MISSING" values

## Still Not Working?

Check browser console for:
- `Cognito configuration missing` → Environment variables not set
- `404` on `/auth/callback` → CloudFront error pages not configured
- `Invalid redirect_uri` → Cognito callback URL mismatch

See `S3_CLOUDFRONT_TROUBLESHOOTING.md` for detailed diagnostics.

