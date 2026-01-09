# Quick Deploy to S3 + CloudFront

## Your Backend Configuration

Based on your deployment outputs:

```env
NEXT_PUBLIC_API_URL=https://x8jz28ttug.execute-api.us-east-2.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-2_Cb4IW3we4
NEXT_PUBLIC_COGNITO_CLIENT_ID=776457erti67mcbdlffj8idon6
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_DOMAIN=<get-from-cognito-console>
```

## Step-by-Step Deployment

### 1. Create `.env.local` File

```bash
cd frontend
```

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=https://x8jz28ttug.execute-api.us-east-2.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-2_Cb4IW3we4
NEXT_PUBLIC_COGNITO_CLIENT_ID=776457erti67mcbdlffj8idon6
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_DOMAIN=your-cognito-domain-name
```

**To get Cognito Domain:**
```bash
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-2_Cb4IW3we4 \
  --region us-east-2 \
  --query 'UserPool.Domain'
```

### 2. Build Static Export

```bash
cd frontend
npm install
npm run build:static
```

This creates an `out/` directory with static files.

### 3. Create S3 Bucket

```bash
BUCKET_NAME="aws-inventory-dashboard-frontend"
REGION="us-east-2"

# Create bucket
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Enable static website hosting
aws s3 website s3://$BUCKET_NAME \
    --index-document index.html \
    --error-document index.html
```

### 4. Set Bucket Policy (Public Read)

```bash
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

aws s3api put-bucket-policy \
    --bucket aws-inventory-dashboard-frontend \
    --policy file://bucket-policy.json
```

### 5. Upload to S3

```bash
cd frontend

# Upload static assets (long cache)
aws s3 sync out/ s3://aws-inventory-dashboard-frontend \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML/JSON (no cache)
aws s3 sync out/ s3://aws-inventory-dashboard-frontend \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --include "*.json"
```

### 6. Create CloudFront Distribution

**Using AWS Console:**

1. Go to **CloudFront** → **Create Distribution**
2. **Origin Domain**: Select your S3 bucket
3. **Viewer Protocol Policy**: **Redirect HTTP to HTTPS**
4. **Default Root Object**: `index.html`
5. **Custom Error Responses**:
   - **403 Forbidden** → Response: `/index.html`, Code: `200`
   - **404 Not Found** → Response: `/index.html`, Code: `200`
6. **Create Distribution** (takes 10-15 minutes)

**Or use CloudFormation:**
```bash
aws cloudformation create-stack \
    --stack-name inventory-dashboard-cloudfront \
    --template-body file://frontend/cloudfront-template.yaml \
    --parameters ParameterKey=S3BucketName,ParameterValue=aws-inventory-dashboard-frontend
```

### 7. Update Cognito Callback URLs

After CloudFront is deployed, get the CloudFront domain and update Cognito:

```bash
# Get CloudFront domain
aws cloudformation describe-stacks \
    --stack-name inventory-dashboard-cloudfront \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
    --output text
```

Then in AWS Console:
1. **Cognito** → **User Pools** → `us-east-2_Cb4IW3we4`
2. **App integration** → Your App Client
3. **Hosted UI** → Edit
4. Add to **Callback URLs**:
   - `https://YOUR-CLOUDFRONT-DOMAIN.cloudfront.net/auth/callback`
   - `https://YOUR-CLOUDFRONT-DOMAIN.cloudfront.net`
5. Add to **Sign-out URLs**:
   - `https://YOUR-CLOUDFRONT-DOMAIN.cloudfront.net`

### 8. Invalidate CloudFront Cache

```bash
DIST_ID="your-cloudfront-distribution-id"

aws cloudfront create-invalidation \
    --distribution-id $DIST_ID \
    --paths "/*"
```

## Windows PowerShell Script

```powershell
cd frontend

# Set variables
$BucketName = "aws-inventory-dashboard-frontend"
$DistributionId = "YOUR_CLOUDFRONT_DIST_ID"  # Optional

# Run deployment script
.\deploy.ps1 -BucketName $BucketName -DistributionId $DistributionId
```

## Verification

1. Visit your CloudFront URL: `https://YOUR-DIST-ID.cloudfront.net`
2. Test login flow
3. Test dashboard navigation
4. Check browser console for errors

## Files Updated

- ✅ `frontend/next.config.js` - Updated for static export
- ✅ `frontend/package.json` - Added `build:static` script
- ✅ `frontend/.env.local` - **YOU NEED TO CREATE THIS**

## Troubleshooting

**Build fails?**
- Check `.env.local` exists
- Verify all environment variables are set
- Run `npm install` first

**404 on routes?**
- Configure CloudFront error responses (Step 6)
- Ensure `/index.html` is set for 403/404 errors

**CORS errors?**
- Verify backend CORS allows your CloudFront domain
- Check API Gateway CORS configuration

## Next Steps

1. ✅ Create `.env.local` with your values
2. ✅ Build: `npm run build:static`
3. ✅ Upload to S3
4. ✅ Create CloudFront distribution
5. ✅ Update Cognito callback URLs
6. ✅ Test!

For detailed instructions, see `FRONTEND_S3_CLOUDFRONT_DEPLOYMENT.md`

