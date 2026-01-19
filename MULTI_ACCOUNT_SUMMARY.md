# Multi-Account Support - Implementation Summary

## ✅ What's Already Implemented

Your application **already has multi-account support built-in**! The infrastructure is in place:

### Backend (Already Working)
- ✅ Cross-account role assumption (`assume_role` in `aws_client.py`)
- ✅ Account discovery via AWS Organizations or environment variable
- ✅ Multi-account inventory collection (`collect_inventory` function)
- ✅ `/accounts` API endpoint to list available accounts
- ✅ Lambda has `sts:AssumeRole` permission

### Frontend (Already Working)
- ✅ Account selection dropdown in dashboard
- ✅ Account filtering in API calls
- ✅ Account display in resource tables

## 🔧 What You Need to Do

### Step 1: Create IAM Role in Each Member Account

For each AWS account you want to monitor, create an IAM role that the Lambda function can assume.

**Quick Setup Options:**

1. **CloudFormation** (Recommended):
   ```bash
   aws cloudformation create-stack \
     --stack-name inventory-read-role \
     --template-body file://member-account-role.yaml \
     --parameters \
       ParameterKey=MainAccountId,ParameterValue=YOUR_MAIN_ACCOUNT_ID \
       ParameterKey=LambdaExecutionRoleName,ParameterValue=YOUR_LAMBDA_ROLE_NAME \
     --capabilities CAPABILITY_NAMED_IAM
   ```

2. **Script** (Bash):
   ```bash
   ./scripts/create-member-account-role.sh MEMBER_ACCOUNT_ID MAIN_ACCOUNT_ID
   ```

3. **Script** (PowerShell):
   ```powershell
   .\scripts\create-member-account-role.ps1 -MemberAccountId MEMBER_ACCOUNT_ID -MainAccountId MAIN_ACCOUNT_ID
   ```

4. **Manual** (AWS Console):
   - See `MULTI_ACCOUNT_SETUP.md` for detailed instructions

### Step 2: Configure Account Discovery

**Option A: AWS Organizations** (Automatic)
- If your accounts are in AWS Organizations, no configuration needed!
- The Lambda will automatically discover all active accounts

**Option B: Manual List** (Environment Variable)
- Set `INVENTORY_ACCOUNTS` in Lambda environment variables:
  ```
  Format: accountId1:AccountName1,accountId2:AccountName2
  Example: 123456789012:Production,987654321098:Development
  ```

### Step 3: Get Lambda Execution Role Info

To create the trust policy in member accounts, you need your Lambda execution role ARN:

```bash
# Use the helper script
./scripts/get-lambda-role-info.sh

# Or manually
aws iam list-roles --query 'Roles[?contains(RoleName, `InventoryFunction`)].Arn' --output text
```

## 📋 IAM Role Requirements

### Role Name
- Default: `InventoryReadRole`
- Must match the `InventoryRoleName` parameter in your SAM template

### Trust Policy
Allows your Lambda execution role to assume this role:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::MAIN_ACCOUNT_ID:role/YOUR_LAMBDA_ROLE_NAME"
    },
    "Action": "sts:AssumeRole"
  }]
}
```

### Permissions Policy
Read-only access to:
- EC2, S3, RDS, DynamoDB, IAM, VPC, EKS, ECS

See `MULTI_ACCOUNT_SETUP.md` for the complete policy JSON.

## 📚 Documentation Files

1. **MULTI_ACCOUNT_SETUP.md** - Complete setup guide with all details
2. **MULTI_ACCOUNT_QUICK_START.md** - Condensed quick reference
3. **member-account-role.yaml** - CloudFormation template for member accounts
4. **scripts/** - Helper scripts for automation

## 🔍 Testing

1. **Verify Account Discovery:**
   - Open dashboard
   - Check "Accounts" dropdown shows your accounts

2. **Test Inventory Collection:**
   - Select an account from dropdown
   - View inventory for that account
   - Check CloudWatch logs for any errors

3. **Troubleshooting:**
   - See "Troubleshooting" section in `MULTI_ACCOUNT_SETUP.md`
   - Check CloudWatch logs for detailed error messages

## 🔒 Security Best Practices

1. **Use External ID** (Recommended):
   - Set `ExternalId` parameter in SAM template
   - Use same value in member account trust policies
   - Prevents confused deputy attacks

2. **Specific Role ARN** (Recommended):
   - Use specific Lambda role ARN in trust policy
   - More secure than using account root

3. **Least Privilege**:
   - Role only has read permissions
   - No write or delete permissions

## 🚀 Next Steps

1. Read `MULTI_ACCOUNT_QUICK_START.md` for a quick setup
2. Create roles in your member accounts
3. Configure account discovery
4. Test the setup
5. Refer to `MULTI_ACCOUNT_SETUP.md` for detailed information

## ❓ Questions?

If you need clarification on:
- **IAM roles and policies**: See `MULTI_ACCOUNT_SETUP.md` section "IAM Policy for Member Account Role"
- **Account discovery**: See `MULTI_ACCOUNT_SETUP.md` section "Step 3: Configure Account Discovery"
- **Troubleshooting**: See `MULTI_ACCOUNT_SETUP.md` section "Troubleshooting"
- **Security**: See `MULTI_ACCOUNT_SETUP.md` section "Security Best Practices"

## 📝 Quick Command Reference

```bash
# Get Lambda role info
./scripts/get-lambda-role-info.sh

# Create role in member account
./scripts/create-member-account-role.sh MEMBER_ACCOUNT_ID MAIN_ACCOUNT_ID

# List accounts (test API)
curl -H "Authorization: Bearer TOKEN" https://API_URL/accounts

# Check CloudWatch logs
aws logs tail /aws/lambda/aws-inventory-dashboard-InventoryFunction --follow
```

