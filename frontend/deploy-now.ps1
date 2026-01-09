#!/usr/bin/env pwsh
# Quick deployment script

Write-Host "🚀 Deploying to S3 and invalidating CloudFront..." -ForegroundColor Cyan
Write-Host ""

# Sync to S3
Write-Host "📦 Syncing files to S3..." -ForegroundColor Yellow
aws s3 sync out/ s3://nxt-inventory-dashboard --delete
Write-Host "✅ S3 sync complete" -ForegroundColor Green
Write-Host ""

# Invalidate CloudFront - try your distribution ID
Write-Host "🔄 Invalidating CloudFront cache..." -ForegroundColor Yellow
$result = aws cloudfront create-invalidation --distribution-id E2UYSLVK3TFB2R --paths "/*" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CloudFront invalidation created" -ForegroundColor Green
    Write-Host $result
}
else {
    Write-Host "⚠️ Could not create invalidation. Try manually:" -ForegroundColor Yellow
    Write-Host "aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths '/*'" -ForegroundColor White
}

Write-Host ""
Write-Host "✨ Done! Wait 1-2 minutes for CloudFront to update" -ForegroundColor Green
Write-Host "🌐 Then test at: https://aws-dashboard.poc.nexturn.com" -ForegroundColor Cyan
Write-Host "🔍 Open browser console (F12) to see debug logs" -ForegroundColor Cyan
