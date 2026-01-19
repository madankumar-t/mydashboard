# Multi-Account Setup - Quick Start Guide

This is a condensed version of the full setup guide. For detailed information, see `MULTI_ACCOUNT_SETUP.md`.

## Quick Setup (5 Steps)

### Step 1: Get Your Main Account ID

```bash
aws sts get-caller-identity --query Account --output text
```

Save this value - you'll need it for Step 2.

### Step 2: Get Your Lambda Execution Role Name

After deploying your backend, find the Lambda execution role:

```bash
# Option 1: From CloudFormation
aws cloudformation describe-stacks \
  --stack-name aws-inventory-dashboard \
  --query 'Stacks[0].Outputs' \
  --output table

# Option 2: List roles
aws iam list-roles --query 'Roles[?contains(RoleName, `InventoryFunction`)].RoleName' --output text
```

The role name will look like: `aws-inventory-dashboard-InventoryFunctionRole-XXXXXXXX`

### Step 3: Create Role in Member Account

**Option A: Using CloudFormation (Recommended)**

```bash
aws cloudformation create-stack \
  --stack-name inventory-read-role \
  --template-body file://member-account-role.yaml \
  --parameters \
    ParameterKey=MainAccountId,ParameterValue=YOUR_MAIN_ACCOUNT_ID \
    ParameterKey=LambdaExecutionRoleName,ParameterValue=YOUR_LAMBDA_ROLE_NAME \
    ParameterKey=ExternalId,ParameterValue=YOUR_EXTERNAL_ID \
  --capabilities CAPABILITY_NAMED_IAM
```

**Option B: Using Script**

```bash
# Bash
chmod +x scripts/create-member-account-role.sh
./scripts/create-member-account-role.sh MEMBER_ACCOUNT_ID MAIN_ACCOUNT_ID EXTERNAL_ID

# PowerShell
.\scripts\create-member-account-role.ps1 -MemberAccountId MEMBER_ACCOUNT_ID -MainAccountId MAIN_ACCOUNT_ID -ExternalId EXTERNAL_ID
```

**Option C: Using AWS Console**

1. Go to IAM → Roles → Create role
2. Select "AWS account" → "Another AWS account"
3. Enter your main account ID
4. (Optional) Check "Require external ID" and enter your external ID
5. Attach the policy from `MULTI_ACCOUNT_SETUP.md` (IAM Policy section)
6. Name: `InventoryReadRole`

### Step 4: Configure Account Discovery

**If using AWS Organizations:**
- No configuration needed! Accounts are discovered automatically.

**If NOT using Organizations:**
- Set Lambda environment variable `INVENTORY_ACCOUNTS`:
  ```
  Format: accountId1:AccountName1,accountId2:AccountName2
  Example: 123456789012:Production,987654321098:Development
  ```

### Step 5: Test

1. Open your dashboard
2. Check the "Accounts" dropdown - you should see your accounts
3. Select an account and view inventory

## IAM Role Summary

### What to Create in Each Member Account

**Role Name:** `InventoryReadRole` (or match your `InventoryRoleName` parameter)

**Trust Policy:** Allows your Lambda execution role to assume this role

**Permissions:** Read-only access to:
- EC2, S3, RDS, DynamoDB, IAM, VPC, EKS, ECS

See `MULTI_ACCOUNT_SETUP.md` for complete policy JSON.

## Common Issues

**"Access Denied" when assuming role:**
- Verify trust policy allows your Lambda role
- Check external ID matches (if using)
- Ensure role name matches `InventoryRoleName` parameter

**Accounts not showing:**
- Check `INVENTORY_ACCOUNTS` environment variable (if not using Organizations)
- Verify Organizations access (if using Organizations)
- Check CloudWatch logs

## Security Notes

1. **External ID**: Highly recommended for production
2. **Specific Role ARN**: Better than account root in trust policy
3. **Least Privilege**: Role only has read permissions

## Full Documentation

For complete details, troubleshooting, and advanced configuration, see:
- `MULTI_ACCOUNT_SETUP.md` - Complete setup guide
- `member-account-role.yaml` - CloudFormation template

