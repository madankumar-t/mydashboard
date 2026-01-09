# Frontend Deployment Checklist

## Pre-Deployment

- [ ] Backend deployed successfully
- [ ] Backend API URL available
- [ ] Cognito User Pool ID available
- [ ] Cognito Client ID available
- [ ] Cognito Domain name available
- [ ] Cognito App Client has correct callback URLs configured

## Configuration Files

### 1. Create `.env.local`

**Location**: `frontend/.env.local`

**Content** (use your actual values):
```env
NEXT_PUBLIC_API_URL=https://x8jz28ttug.execute-api.us-east-2.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-2_Cb4IW3we4
NEXT_PUBLIC_COGNITO_CLIENT_ID=776457erti67mcbdlffj8idon6
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_DOMAIN=your-cognito-domain-name
```

**How to get Cognito Domain:**
```bash
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-2_Cb4IW3we4 \
  --region us-east-2 \
  --query 'UserPool.Domain'
```

Or in AWS Console:
- Cognito → User Pools → Your Pool → App integration → Domain

### 2. Verify `next.config.js`

✅ Already configured for static export
- `output: process.env.NEXT_EXPORT ? 'export' : 'standalone'`
- `images: { unoptimized: true }`
- `trailingSlash: true`

## Build & Deploy Steps

### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

### Step 2: Build Static Export
```bash
npm run build:static
```

**Verify**: Check that `out/` directory is created with HTML, JS, CSS files.

### Step 3: Create S3 Bucket
```bash
BUCKET_NAME="aws-inventory-dashboard-frontend"
REGION="us-east-2"

aws s3 mb s3://$BUCKET_NAME --region $REGION
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html
```

### Step 4: Set Bucket Policy
```bash
# Create bucket-policy.json
cat > bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::aws-inventory-dashboard-frontend/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket aws-inventory-dashboard-frontend --policy file://bucket-policy.json
```

### Step 5: Upload to S3
```bash
cd frontend

# Upload static assets
aws s3 sync out/ s3://aws-inventory-dashboard-frontend \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" --exclude "*.json"

# Upload HTML/JSON
aws s3 sync out/ s3://aws-inventory-dashboard-frontend \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" --include "*.json"
```

### Step 6: Create CloudFront Distribution

**Using AWS Console:**
1. CloudFront → Create Distribution
2. Origin: Your S3 bucket
3. Viewer Protocol: Redirect HTTP to HTTPS
4. Default Root Object: `index.html`
5. **Custom Error Responses** (IMPORTANT):
   - 403 → `/index.html` (200)
   - 404 → `/index.html` (200)
6. Create Distribution

**Or use CloudFormation:**
```bash
aws cloudformation create-stack \
    --stack-name inventory-dashboard-cloudfront \
    --template-body file://frontend/cloudfront-template.yaml \
    --parameters ParameterKey=S3BucketName,ParameterValue=aws-inventory-dashboard-frontend
```

### Step 7: Update Cognito Callback URLs

After CloudFront is deployed:

1. Get CloudFront domain:
   ```bash
   aws cloudformation describe-stacks \
       --stack-name inventory-dashboard-cloudfront \
       --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
       --output text
   ```

2. Update Cognito App Client:
   - AWS Console → Cognito → User Pools → `us-east-2_Cb4IW3we4`
   - App integration → Your App Client → Hosted UI
   - Add to **Callback URLs**:
     - `https://YOUR-CLOUDFRONT-DOMAIN.cloudfront.net/auth/callback`
     - `https://YOUR-CLOUDFRONT-DOMAIN.cloudfront.net`
   - Add to **Sign-out URLs**:
     - `https://YOUR-CLOUDFRONT-DOMAIN.cloudfront.net`

### Step 8: Invalidate CloudFront Cache
```bash
DIST_ID="your-cloudfront-distribution-id"
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

## Verification

- [ ] CloudFront distribution is deployed (Status: Deployed)
- [ ] Can access frontend at CloudFront URL
- [ ] Login redirects to Cognito Hosted UI
- [ ] Authentication callback works
- [ ] Dashboard loads correctly
- [ ] API calls succeed
- [ ] No console errors

## Files Summary

**Files You Need to Create:**
- ✅ `frontend/.env.local` - **REQUIRED** (create this file)

**Files Already Configured:**
- ✅ `frontend/next.config.js` - Static export ready
- ✅ `frontend/package.json` - Build scripts added
- ✅ `frontend/deploy-s3-cloudfront.sh` - Linux/Mac deployment script
- ✅ `frontend/deploy.ps1` - Windows PowerShell script
- ✅ `frontend/cloudfront-template.yaml` - CloudFormation template

**Documentation:**
- ✅ `frontend/FRONTEND_S3_CLOUDFRONT_DEPLOYMENT.md` - Complete guide
- ✅ `frontend/QUICK_DEPLOY_S3.md` - Quick reference

## Quick Commands

**Windows (PowerShell):**
```powershell
cd frontend
.\deploy.ps1 -BucketName "aws-inventory-dashboard-frontend" -DistributionId "YOUR_DIST_ID"
```

**Linux/Mac:**
```bash
cd frontend
chmod +x deploy-s3-cloudfront.sh
./deploy-s3-cloudfront.sh
```

**Manual:**
```bash
cd frontend
npm run build:static
aws s3 sync out/ s3://aws-inventory-dashboard-frontend --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Troubleshooting

See `FRONTEND_S3_CLOUDFRONT_DEPLOYMENT.md` for detailed troubleshooting.

