# CloudFront SPA Configuration for Custom Domain

## Problem

When accessing `/auth/callback` on custom domain `https://saml-sso.dev.sectest.dcli.com`, it immediately redirects back to Cognito.

## Root Cause

CloudFront returns 404 for `/auth/callback` because:
1. The route doesn't exist as a physical file in S3
2. CloudFront error pages aren't configured to serve `index.html`
3. The React app never loads, so it can't handle client-side routing

## Solution: Two Options

### Option 1: CloudFront Error Pages (Recommended - Easier)

**Configure in AWS Console:**

1. **CloudFront** → Your Distribution → **Error Pages** tab
2. **Create/Edit Error Response:**

   **For 403:**
   - HTTP Error Code: `403`
   - Response Page Path: `/index.html`
   - HTTP Response Code: `200`
   - Error Caching Minimum TTL: `0`

   **For 404:**
   - HTTP Error Code: `404`
   - Response Page Path: `/index.html`
   - HTTP Response Code: `200`
   - Error Caching Minimum TTL: `0`

3. **Save**
4. **Invalidate cache**: `aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"`

### Option 2: CloudFront Function (More Control)

**Create Function:**

1. **CloudFront** → **Functions** → **Create Function**
2. Name: `spa-routing`
3. Code:

```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // If it's a file (has extension), serve as-is
    if (uri.includes('.') && !uri.endsWith('/')) {
        return request;
    }
    
    // For all routes (/, /auth/callback, /dashboard, etc.), serve index.html
    if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
    } else {
        request.uri = '/index.html';
    }
    
    return request;
}
```

4. **Publish** function
5. **Associate with Distribution:**
   - Distribution → **Behaviors** → Edit default behavior
   - **Function associations** → **Viewer request** → Select `spa-routing`
   - **Save**
6. **Invalidate cache**

## Verify Configuration

### Check Error Pages (Option 1)

```bash
aws cloudfront get-distribution-config \
  --id YOUR_DIST_ID \
  --query 'DistributionConfig.CustomErrorResponses.Items'
```

Should show 403 and 404 configured to return `/index.html` with status 200.

### Check Function (Option 2)

```bash
aws cloudfront list-functions --query 'FunctionList.Items[?Name==`spa-routing`]'
```

## Test

1. Visit: `https://saml-sso.dev.sectest.dcli.com/auth/callback?code=test`
2. Should load the React app (not redirect immediately)
3. Check browser console for logs
4. Check Network tab - `/auth/callback` should return 200

## Why This Happens

- **Static export** creates `index.html` at root
- Routes like `/auth/callback` don't exist as files
- CloudFront returns 404 by default
- Error pages tell CloudFront to serve `index.html` for 404
- React app loads and handles routing client-side

## Additional Configuration

### Query String Forwarding

Ensure CloudFront forwards query strings (for `?code=...`):

1. Distribution → **Behaviors** → Edit
2. **Cache key and origin requests**
3. **Query strings**: Forward all
4. **Save**

### Cache Policy

For HTML files, use a cache policy that:
- Doesn't cache HTML files (or very short TTL)
- Caches static assets (JS, CSS) for long time

## Troubleshooting

### Still Getting 404?

1. Check error pages are configured correctly
2. Invalidate CloudFront cache
3. Wait 2-3 minutes for changes to propagate
4. Check browser Network tab - what status code is returned?

### Callback Loads But Redirects Immediately?

1. Check browser console for JavaScript errors
2. Check if session is being stored: `localStorage.getItem('aws-inventory-session')`
3. Check if token exchange is failing (Network tab)

### Works on CloudFront Domain But Not Custom Domain?

1. Verify custom domain is added to distribution's **Alternate Domain Names (CNAMEs)**
2. Verify SSL certificate is attached to distribution
3. Verify DNS is pointing to CloudFront distribution

