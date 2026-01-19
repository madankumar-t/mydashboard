#!/usr/bin/env pwsh
# Complete rebuild and deployment script

Write-Host "🧹 Cleaning old build..." -ForegroundColor Cyan
Remove-Item -Path .next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path out -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✅ Cleaned" -ForegroundColor Green
Write-Host ""

Write-Host "🔨 Building for static export..." -ForegroundColor Cyan
$env:NEXT_EXPORT = "true"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build complete" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Syncing to S3..." -ForegroundColor Cyan
aws s3 sync out/ s3://nxt-inventory-dashboard --delete

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ S3 sync failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ S3 sync complete" -ForegroundColor Green
Write-Host ""

Write-Host "🔄 Invalidating CloudFront..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id E1WFQYNOO84626 --paths "/*"

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ CloudFront invalidation failed - try manually:" -ForegroundColor Yellow
    Write-Host "aws cloudfront create-invalidation --distribution-id YOUR_ID --paths '/*'" -ForegroundColor White
}
else {
    Write-Host "✅ CloudFront invalidation created" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Wait 2-3 minutes for CloudFront" -ForegroundColor White
Write-Host "2. Clear browser cache (Ctrl+Shift+Delete)" -ForegroundColor White
Write-Host "3. Open console FIRST (F12)" -ForegroundColor White
Write-Host "4. Go to: https://aws-dashboard.poc.nexturn.com" -ForegroundColor White
Write-Host "5. Sign in and watch console logs" -ForegroundColor White
