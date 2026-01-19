#!/bin/bash
# Deployment script for S3 + CloudFront
# Usage: ./deploy-s3-cloudfront.sh

set -e

# Configuration - Update these values
S3_BUCKET_NAME="aws-inventory-dashboard-frontend"
CLOUDFRONT_DISTRIBUTION_ID=""  # Will be created or use existing
AWS_REGION="us-east-2"
PROFILE=""  # Optional: AWS profile name

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting frontend deployment to S3 + CloudFront...${NC}"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${RED}Error: .env.local file not found!${NC}"
    echo "Please create .env.local with your configuration."
    exit 1
fi

# Step 1: Install dependencies
echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
npm install

# Step 2: Build static export
echo -e "${YELLOW}Step 2: Building static export...${NC}"
export NEXT_EXPORT=true
npm run build:static

# Step 3: Check if out directory exists
if [ ! -d "out" ]; then
    echo -e "${RED}Error: 'out' directory not found after build!${NC}"
    echo "Make sure next.config.js has output: 'export'"
    exit 1
fi

# Step 4: Create S3 bucket if it doesn't exist
echo -e "${YELLOW}Step 3: Checking S3 bucket...${NC}"
if [ -n "$PROFILE" ]; then
    AWS_CMD="aws --profile $PROFILE"
else
    AWS_CMD="aws"
fi

if ! $AWS_CMD s3 ls "s3://$S3_BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "Bucket exists: $S3_BUCKET_NAME"
else
    echo "Creating bucket: $S3_BUCKET_NAME"
    $AWS_CMD s3 mb "s3://$S3_BUCKET_NAME" --region $AWS_REGION
    
    # Enable static website hosting
    $AWS_CMD s3 website "s3://$S3_BUCKET_NAME" \
        --index-document index.html \
        --error-document index.html
fi

# Step 5: Upload files to S3
echo -e "${YELLOW}Step 4: Uploading files to S3...${NC}"
$AWS_CMD s3 sync out/ "s3://$S3_BUCKET_NAME" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML files with no-cache
$AWS_CMD s3 sync out/ "s3://$S3_BUCKET_NAME" \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --include "*.json"

# Step 6: Set proper content types
echo -e "${YELLOW}Step 5: Setting content types...${NC}"
$AWS_CMD s3 cp "s3://$S3_BUCKET_NAME" "s3://$S3_BUCKET_NAME" \
    --recursive \
    --exclude "*" \
    --include "*.js" \
    --content-type "application/javascript" \
    --metadata-directive REPLACE

$AWS_CMD s3 cp "s3://$S3_BUCKET_NAME" "s3://$S3_BUCKET_NAME" \
    --recursive \
    --exclude "*" \
    --include "*.css" \
    --content-type "text/css" \
    --metadata-directive REPLACE

# Step 7: Create or update CloudFront distribution
if [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "${YELLOW}Step 6: Creating CloudFront distribution...${NC}"
    echo "Please create CloudFront distribution manually or update CLOUDFRONT_DISTRIBUTION_ID in this script"
    echo "See FRONTEND_S3_CLOUDFRONT_DEPLOYMENT.md for CloudFront setup instructions"
else
    echo -e "${YELLOW}Step 6: Invalidating CloudFront cache...${NC}"
    $AWS_CMD cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*"
fi

echo -e "${GREEN}Deployment complete!${NC}"
echo "S3 Bucket: s3://$S3_BUCKET_NAME"
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"
fi

