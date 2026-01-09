# Cognito Configuration Guide

## Where to Update Cognito Credentials

### File: `.env.local` (in `frontend/` directory)

Create or edit the `.env.local` file in the `frontend/` directory with your Cognito credentials:

```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain-name
```

## How to Get Cognito Credentials

### Step 1: Deploy Backend

First, deploy the backend to get Cognito credentials:

```bash
cd backend
sam build
sam deploy --guided
```

### Step 2: Get Outputs from CloudFormation

After deployment, get the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name aws-inventory-dashboard \
  --query 'Stacks[0].Outputs'
```

Or check in AWS Console:
1. Go to CloudFormation
2. Select your stack
3. Go to "Outputs" tab

You'll see:
- `UserPoolId` - This is your `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `ClientId` - This is your `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `CognitoDomain` - This is your `NEXT_PUBLIC_COGNITO_DOMAIN`

### Step 3: Update .env.local

Copy the values to your `.env.local` file:

```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_AbCdEfGh
NEXT_PUBLIC_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_DOMAIN=aws-inventory-dashboard-auth
```

### Step 4: Restart Dev Server

After updating `.env.local`, restart your Next.js dev server:

```bash
# Stop the server (Ctrl+C)
npm run dev
```

## File Structure

```
frontend/
├── .env.local          ← UPDATE THIS FILE
├── .env.local.example  (template - don't edit)
├── next.config.js      (reads from .env.local)
└── src/
    └── lib/
        └── auth.ts     (uses process.env.NEXT_PUBLIC_*)
```

## Important Notes

1. **`.env.local` is in `.gitignore`** - Your credentials won't be committed to git
2. **Restart required** - Next.js only reads env vars at startup
3. **NEXT_PUBLIC_ prefix** - Required for client-side access in Next.js
4. **No quotes needed** - Don't wrap values in quotes in `.env.local`

## Example .env.local

```env
# API URL
NEXT_PUBLIC_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod

# Cognito (from CloudFormation outputs)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_AbCdEfGh
NEXT_PUBLIC_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_DOMAIN=aws-inventory-dashboard-auth
```

## Verification

After updating, check the browser console. You should NOT see:
```
⚠️ Cognito configuration missing...
```

If you still see warnings, verify:
1. ✅ File is named exactly `.env.local` (not `.env` or `.env.local.txt`)
2. ✅ File is in the `frontend/` directory (not root)
3. ✅ Values don't have quotes around them
4. ✅ Dev server was restarted after changes

## Troubleshooting

### Values not updating?
- Restart the dev server
- Check file name is exactly `.env.local`
- Check file is in `frontend/` directory

### Still seeing warnings?
- Verify values are correct (no typos)
- Check CloudFormation outputs match
- Clear browser cache

### For Production Deployment

For production, set these as environment variables in your hosting platform:
- Vercel: Project Settings → Environment Variables
- AWS Amplify: App Settings → Environment Variables
- Other platforms: Check their documentation

