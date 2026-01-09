# Fix 403 Error on Auth Callback

## Problem
Getting 403 Forbidden error when accessing `/auth/callback` after authentication.

## Root Cause
CloudFront/S3 doesn't know how to serve the Next.js SPA route `/auth/callback`. The static export creates an `index.html` at the root, but CloudFront needs to be told to serve it for all routes.

## Solution Applied

### 1. Updated CloudFront Configuration
Added a CloudFront Function to handle SPA routing by rewriting all non-file requests to `/index.html`.

### 2. Fixed Cache Settings
- Removed conflicting `CachePolicyId`
- Set `QueryString: true` to forward auth codes
- Reduced error caching to prevent caching 403/404 errors

### 3. Deploy Updated CloudFront Stack

```bash
cd frontend

# Update CloudFront distribution
aws cloudformation update-stack \
  --stack-name aws-inventory-dashboard-frontend \
  --template-body file://cloudfront-template.yaml \
  --parameters \
    ParameterKey=S3BucketName,ParameterValue=YOUR_BUCKET_NAME \
    ParameterKey=CustomDomain,ParameterValue=aws-dashboard.poc.nexturn.com \
    ParameterKey=CertificateArn,ParameterValue=YOUR_ACM_CERT_ARN

# Wait for stack update
aws cloudformation wait stack-update-complete \
  --stack-name aws-inventory-dashboard-frontend
```

### 4. Invalidate CloudFront Cache

After updating the CloudFront distribution, invalidate the cache:

```bash
# Get distribution ID
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name aws-inventory-dashboard-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

### 5. Verify Cognito Callback URLs

Ensure your Cognito App Client has the correct callback URLs configured:

```bash
# Check current callback URLs
aws cognito-idp describe-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --query 'UserPoolClient.CallbackURLs'
```

**Required Callback URLs:**
- `https://aws-dashboard.poc.nexturn.com/auth/callback`
- `http://localhost:3000/auth/callback` (for local development)

**Update if needed:**
```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --callback-urls \
    "https://aws-dashboard.poc.nexturn.com/auth/callback" \
    "http://localhost:3000/auth/callback"
```

## Quick Fix (Alternative)

If you can't update CloudFront stack immediately, you can:

1. **Option A: Use CloudFront Console**
   - Go to CloudFront console
   - Select your distribution
   - Go to "Error Pages" tab
   - Edit 403 response: Response Code = 200, Response Page = `/index.html`
   - Edit 404 response: Response Code = 200, Response Page = `/index.html`
   - Create invalidation for `/*`

2. **Option B: Add CloudFront Function via Console**
   - Go to CloudFront console → Functions
   - Create function with this code:
   ```javascript
   function handler(event) {
     var request = event.request;
     var uri = request.uri;
     
     if (!uri.includes('.')) {
       request.uri = '/index.html';
     } else if (uri.endsWith('/')) {
       request.uri += 'index.html';
     }
     
     return request;
   }
   ```
   - Publish the function
   - Associate with your distribution's viewer-request event

## Testing

After applying the fix:

1. Clear browser cache and cookies
2. Try accessing: `https://aws-dashboard.poc.nexturn.com/`
3. Click "Sign In" and authenticate
4. You should be redirected to `/auth/callback` and then to `/dashboard`

## Still Having Issues?

Check CloudWatch Logs for the CloudFront Function:
```bash
aws logs tail /aws/cloudfront/function/$FUNCTION_NAME --follow
```

Verify the Next.js build output includes `index.html`:
```bash
cd frontend
npm run build
ls -la out/
# Should see: index.html, _next/, etc.
```
