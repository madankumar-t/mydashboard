# Frontend Deployment to S3 + CloudFront

## Overview

This guide covers deploying the Next.js frontend to AWS S3 with CloudFront CDN for production.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js 18+** installed
3. **Backend deployed** and API URL available
4. **Cognito credentials** from backend deployment

## Step 1: Configure Environment Variables

Create `.env.local` in the `frontend/` directory:

```env
# Backend API URL (from CloudFormation output)
NEXT_PUBLIC_API_URL=https://x8jz28ttug.execute-api.us-east-2.amazonaws.com/prod

# Cognito Configuration (from CloudFormation outputs)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-2_Cb4IW3we4
NEXT_PUBLIC_COGNITO_CLIENT_ID=776457erti67mcbdlffj8idon6
NEXT_PUBLIC_COGNITO_REGION=us-east-2

# Cognito Domain (get from your existing Cognito User Pool)
# AWS Console → Cognito → User Pools → Your Pool → App integration → Domain
NEXT_PUBLIC_COGNITO_DOMAIN=your-cognito-domain-name
```

## Step 2: Update Next.js Configuration

The `next.config.js` has been updated to support static export. Verify it includes:

```javascript
output: process.env.NEXT_EXPORT ? 'export' : 'standalone',
images: {
  unoptimized: true
},
trailingSlash: true,
```

## Step 3: Build Static Export

```bash
cd frontend
npm install
npm run build:static
```

This will create an `out/` directory with static files ready for S3.

## Step 4: Create S3 Bucket

### Option A: Using AWS CLI

```bash
# Set your bucket name
BUCKET_NAME="aws-inventory-dashboard-frontend"
REGION="us-east-2"

# Create bucket
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Enable static website hosting
aws s3 website s3://$BUCKET_NAME \
    --index-document index.html \
    --error-document index.html

# Set bucket policy for public read access
cat > bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json
```

### Option B: Using AWS Console

1. Go to S3 → Create bucket
2. Bucket name: `aws-inventory-dashboard-frontend` (or your preferred name)
3. Region: `us-east-2` (or your region)
4. **Block Public Access**: Uncheck "Block all public access" (or configure as needed)
5. Enable **Static website hosting**:
   - Index document: `index.html`
   - Error document: `index.html`
6. Set bucket policy for public read access (see Option A above)

## Step 5: Upload to S3

### Option A: Using Deployment Script

```bash
cd frontend
chmod +x deploy-s3-cloudfront.sh

# Edit the script to set your bucket name
# Then run:
./deploy-s3-cloudfront.sh
```

### Option B: Manual Upload

```bash
cd frontend

# Build static export
npm run build:static

# Upload all files
aws s3 sync out/ s3://aws-inventory-dashboard-frontend \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML/JSON with no-cache
aws s3 sync out/ s3://aws-inventory-dashboard-frontend \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --include "*.json"

# Set content types
aws s3 cp s3://aws-inventory-dashboard-frontend s3://aws-inventory-dashboard-frontend \
    --recursive \
    --exclude "*" \
    --include "*.js" \
    --content-type "application/javascript" \
    --metadata-directive REPLACE

aws s3 cp s3://aws-inventory-dashboard-frontend s3://aws-inventory-dashboard-frontend \
    --recursive \
    --exclude "*" \
    --include "*.css" \
    --content-type "text/css" \
    --metadata-directive REPLACE
```

## Step 6: Create CloudFront Distribution

### Option A: Using AWS Console

1. **Go to CloudFront** → Create Distribution

2. **Origin Settings**:
   - Origin Domain: Select your S3 bucket (or use S3 website endpoint)
   - Origin Path: (leave empty)
   - Name: Auto-generated
   - Origin Access: 
     - Select "S3 bucket" (not website endpoint) if using OAC
     - Or use "Public" if bucket is public

3. **Default Cache Behavior**:
   - Viewer Protocol Policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP Methods: **GET, HEAD, OPTIONS**
   - Cache Policy: **CachingOptimized** (or create custom)
   - Origin Request Policy: **None** (or CORS-CustomOrigin if needed)

4. **Distribution Settings**:
   - Price Class: **Use All Edge Locations** (or select based on needs)
   - Alternate Domain Names (CNAMEs): Your custom domain (optional)
   - SSL Certificate: Default CloudFront certificate (or upload custom)
   - Default Root Object: `index.html`
   - Custom Error Responses:
     - HTTP Error Code: `403`
     - Response Page Path: `/index.html`
     - HTTP Response Code: `200`
     - HTTP Error Code: `404`
     - Response Page Path: `/index.html`
     - HTTP Response Code: `200`

5. **Create Distribution** (takes 10-15 minutes to deploy)

### Option B: Using CloudFormation/SAM

See `frontend/cloudfront-template.yaml` (create this if needed)

## Step 7: Update Cognito Callback URLs

After CloudFront is deployed, update your Cognito App Client:

1. Go to **Cognito → User Pools → Your Pool → App integration**
2. Click on your App Client
3. Edit **Hosted UI** settings
4. Add CloudFront URL to **Callback URLs**:
   - `https://your-cloudfront-domain.cloudfront.net/auth/callback`
   - `https://your-cloudfront-domain.cloudfront.net`
5. Add to **Sign-out URLs**:
   - `https://your-cloudfront-domain.cloudfront.net`

## Step 8: Configure CloudFront for SPA Routing

Next.js uses client-side routing. Configure CloudFront to handle all routes:

### Custom Error Responses

In CloudFront distribution → Error Pages:

1. **403 Forbidden**:
   - Response Page Path: `/index.html`
   - HTTP Response Code: `200`

2. **404 Not Found**:
   - Response Page Path: `/index.html`
   - HTTP Response Code: `200`

This ensures all routes (like `/dashboard`, `/auth/callback`) are handled by the React app.

## Step 9: Test Deployment

1. **Get CloudFront URL**: 
   - Distribution → Domain Name (e.g., `d1234567890.cloudfront.net`)

2. **Test in Browser**:
   - Visit: `https://your-cloudfront-domain.cloudfront.net`
   - Test login flow
   - Test dashboard navigation
   - Test API calls

## Step 10: Custom Domain (Optional)

### Using Route 53

1. **Create Hosted Zone** (if not exists)
2. **Create A Record** (Alias):
   - Name: `inventory.yourdomain.com`
   - Type: A (Alias)
   - Alias Target: Your CloudFront distribution
   - Alias Hosted Zone: CloudFront hosted zone

3. **Update CloudFront**:
   - Add `inventory.yourdomain.com` to Alternate Domain Names (CNAMEs)
   - Request/upload SSL certificate in ACM (us-east-1 region)

4. **Update Cognito**:
   - Add custom domain callback URLs

## Automation Script

Use the provided `deploy-s3-cloudfront.sh` script:

```bash
cd frontend

# Edit script variables:
# - S3_BUCKET_NAME
# - CLOUDFRONT_DISTRIBUTION_ID (optional)
# - AWS_REGION

chmod +x deploy-s3-cloudfront.sh
./deploy-s3-cloudfront.sh
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy-frontend.yml`:

```yaml
name: Deploy Frontend to S3 + CloudFront

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      
      - name: Build static export
        run: |
          cd frontend
          export NEXT_EXPORT=true
          npm run build:static
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_COGNITO_USER_POOL_ID: ${{ secrets.NEXT_PUBLIC_COGNITO_USER_POOL_ID }}
          NEXT_PUBLIC_COGNITO_CLIENT_ID: ${{ secrets.NEXT_PUBLIC_COGNITO_CLIENT_ID }}
          NEXT_PUBLIC_COGNITO_REGION: ${{ secrets.NEXT_PUBLIC_COGNITO_REGION }}
          NEXT_PUBLIC_COGNITO_DOMAIN: ${{ secrets.NEXT_PUBLIC_COGNITO_DOMAIN }}
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-2
      
      - name: Deploy to S3
        run: |
          cd frontend
          aws s3 sync out/ s3://aws-inventory-dashboard-frontend --delete
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

## Security Best Practices

### 1. S3 Bucket Security

**Option A: Public Bucket (Simple)**
- Enable public read access
- Use bucket policy for public GetObject

**Option B: Private Bucket with CloudFront OAC (Recommended)**
- Keep bucket private
- Use CloudFront Origin Access Control (OAC)
- More secure but requires additional setup

### 2. CloudFront Security

- ✅ **HTTPS Only**: Redirect HTTP to HTTPS
- ✅ **WAF**: Add AWS WAF for DDoS protection
- ✅ **Security Headers**: Add security headers via CloudFront Functions
- ✅ **Custom Domain**: Use your own domain with SSL

### 3. Environment Variables

- ✅ Never commit `.env.local` to git
- ✅ Use AWS Systems Manager Parameter Store or Secrets Manager for production
- ✅ Rotate credentials regularly

## Troubleshooting

### Issue: "404 Not Found" on routes

**Solution**: Configure CloudFront error responses (Step 8)

### Issue: "CORS Error"

**Solution**: 
- Verify backend CORS is configured
- Check CloudFront origin settings
- Ensure API Gateway allows your CloudFront domain

### Issue: "Static export failed"

**Solution**:
- Check for server-side code (should be client-side only)
- Verify `next.config.js` has `output: 'export'`
- Check for dynamic routes that need `generateStaticParams`

### Issue: "Assets not loading"

**Solution**:
- Check S3 bucket policy allows public read
- Verify CloudFront origin is correct
- Check content types are set correctly

## Cost Optimization

1. **CloudFront Caching**:
   - Cache static assets (JS, CSS, images) for 1 year
   - Don't cache HTML files

2. **S3 Storage Class**:
   - Use Standard storage (cheapest for frequent access)
   - Consider lifecycle policies for old deployments

3. **CloudFront Price Class**:
   - Use "Use Only North America and Europe" if users are in these regions

## Monitoring

1. **CloudWatch**:
   - Monitor CloudFront distribution metrics
   - Set up alarms for errors

2. **S3 Access Logs**:
   - Enable S3 access logging
   - Analyze access patterns

3. **CloudFront Logs**:
   - Enable CloudFront access logs
   - Monitor for errors and performance

## Summary

**Files to Update:**
- ✅ `frontend/.env.local` - Environment variables
- ✅ `frontend/next.config.js` - Already updated for static export

**Deployment Steps:**
1. ✅ Create `.env.local` with backend/Cognito values
2. ✅ Build static export: `npm run build:static`
3. ✅ Create S3 bucket
4. ✅ Upload to S3
5. ✅ Create CloudFront distribution
6. ✅ Configure error responses for SPA routing
7. ✅ Update Cognito callback URLs
8. ✅ Test deployment

**Quick Deploy:**
```bash
cd frontend
npm install
npm run build:static
aws s3 sync out/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

Your frontend will be available at your CloudFront domain! 🚀

