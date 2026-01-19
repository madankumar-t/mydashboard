# PowerShell deployment script for S3 + CloudFront (Windows)
# Usage: .\deploy.ps1

param(
    [string]$BucketName = "aws-inventory-dashboard-frontend",
    [string]$DistributionId = "",
    [string]$Region = "us-east-2",
    [string]$Profile = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Starting frontend deployment to S3 + CloudFront..." -ForegroundColor Green

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "Error: .env.local file not found!" -ForegroundColor Red
    Write-Host "Please create .env.local with your configuration."
    exit 1
}

# Step 1: Install dependencies
Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 2: Build static export
Write-Host "Step 2: Building static export..." -ForegroundColor Yellow
$env:NEXT_EXPORT = "true"
npm run build:static
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
}

# Step 3: Check if out directory exists
if (-not (Test-Path "out")) {
    Write-Host "Error: 'out' directory not found after build!" -ForegroundColor Red
    Write-Host "Make sure next.config.js has output: 'export'"
    exit 1
}

# Step 4: Configure AWS CLI
$awsCmd = "aws"
if ($Profile) {
    $awsCmd = "aws --profile $Profile"
}

# Step 5: Create S3 bucket if it doesn't exist
Write-Host "Step 3: Checking S3 bucket..." -ForegroundColor Yellow
$bucketExists = & $awsCmd s3 ls "s3://$BucketName" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating bucket: $BucketName" -ForegroundColor Yellow
    & $awsCmd s3 mb "s3://$BucketName" --region $Region
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create bucket" -ForegroundColor Red
        exit 1
    }
    
    # Enable static website hosting
    & $awsCmd s3 website "s3://$BucketName" --index-document index.html --error-document index.html
} else {
    Write-Host "Bucket exists: $BucketName" -ForegroundColor Green
}

# Step 6: Upload files to S3
Write-Host "Step 4: Uploading files to S3..." -ForegroundColor Yellow

# Upload static assets with long cache
& $awsCmd s3 sync out/ "s3://$BucketName" --delete `
    --cache-control "public, max-age=31536000, immutable" `
    --exclude "*.html" --exclude "*.json"

# Upload HTML/JSON with no-cache
& $awsCmd s3 sync out/ "s3://$BucketName" --delete `
    --cache-control "public, max-age=0, must-revalidate" `
    --include "*.html" --include "*.json"

# Step 7: Set content types
Write-Host "Step 5: Setting content types..." -ForegroundColor Yellow

# Get all JS files and update content type
Get-ChildItem -Path out -Recurse -Filter "*.js" | ForEach-Object {
    $s3Key = $_.FullName.Replace((Resolve-Path out).Path + "\", "").Replace("\", "/")
    & $awsCmd s3 cp "s3://$BucketName/$s3Key" "s3://$BucketName/$s3Key" `
        --content-type "application/javascript" --metadata-directive REPLACE
}

# Get all CSS files and update content type
Get-ChildItem -Path out -Recurse -Filter "*.css" | ForEach-Object {
    $s3Key = $_.FullName.Replace((Resolve-Path out).Path + "\", "").Replace("\", "/")
    & $awsCmd s3 cp "s3://$BucketName/$s3Key" "s3://$BucketName/$s3Key" `
        --content-type "text/css" --metadata-directive REPLACE
}

# Step 8: Invalidate CloudFront if distribution ID provided
if ($DistributionId) {
    Write-Host "Step 6: Invalidating CloudFront cache..." -ForegroundColor Yellow
    & $awsCmd cloudfront create-invalidation --distribution-id $DistributionId --paths "/*"
    Write-Host "CloudFront cache invalidation initiated" -ForegroundColor Green
} else {
    Write-Host "Step 6: Skipping CloudFront invalidation (no distribution ID provided)" -ForegroundColor Yellow
    Write-Host "To invalidate cache, run:" -ForegroundColor Yellow
    Write-Host "  aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths '/*'" -ForegroundColor Cyan
}

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "S3 Bucket: s3://$BucketName" -ForegroundColor Cyan
if ($DistributionId) {
    Write-Host "CloudFront Distribution: $DistributionId" -ForegroundColor Cyan
}

