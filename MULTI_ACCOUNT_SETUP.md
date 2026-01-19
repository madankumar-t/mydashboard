# Multi-Account Setup Guide

This guide explains how to configure the AWS Inventory Dashboard to work with multiple AWS accounts.

## Overview

The application uses **AWS IAM Cross-Account Role Assumption** to access resources in multiple accounts. The Lambda function in the main account assumes a role in each member account to collect inventory.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Account (Hub)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Lambda Function (InventoryFunction)                 │   │
│  │  - Has permission to assume roles in other accounts │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ AssumeRole
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Account A    │  │ Account B    │  │ Account C    │
│              │  │              │  │              │
│ InventoryRead│  │ InventoryRead│  │ InventoryRead│
│ Role         │  │ Role         │  │ Role         │
│              │  │              │  │              │
│ - EC2        │  │ - EC2        │  │ - EC2        │
│ - S3         │  │ - S3         │  │ - S3         │
│ - RDS        │  │ - RDS        │  │ - RDS        │
│ - etc.       │  │ - etc.       │  │ - etc.       │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Prerequisites

1. **Main Account Setup**: The Lambda function must be deployed in the main account
2. **Member Accounts**: Each member account needs an IAM role created
3. **Account Discovery**: Either AWS Organizations or manual account list

## Step 1: Get Your Main Account ID

First, identify your main account ID where the Lambda function is deployed:

```bash
aws sts get-caller-identity --query Account --output text
```

Save this account ID - you'll need it for the trust policy in member accounts.

## Step 2: Create IAM Role in Each Member Account

For each member account, you need to create an IAM role that the Lambda function can assume.

### Option A: Using AWS Console

1. **Navigate to IAM** in the member account
2. **Create Role**:
   - Click "Roles" → "Create role"
   - Select "AWS account" as trusted entity type
   - Choose "Another AWS account"
   - Enter your **Main Account ID** (from Step 1)
   - **Optional but Recommended**: Check "Require external ID" and enter a value
   - Click "Next"

3. **Attach Permissions**:
   - Attach the policy document provided below (see "IAM Policy for Member Account Role")
   - Or create a custom policy with the permissions listed

4. **Name the Role**:
   - Role name: `InventoryReadRole` (or match the `InventoryRoleName` parameter in your SAM template)
   - Description: "Allows inventory dashboard to read resources"
   - Click "Create role"

5. **Configure External ID (Optional but Recommended)**:
   - After creating the role, edit the trust relationship
   - Add `sts:ExternalId` condition if you want to use external ID for security

### Option B: Using AWS CLI

See the "IAM Role Creation Scripts" section below for automated setup.

### Option C: Using CloudFormation

A CloudFormation template is provided in `member-account-role.yaml` (see below).

## Step 3: Configure Account Discovery

The application can discover accounts in two ways:

### Option A: AWS Organizations (Recommended)

If your accounts are part of AWS Organizations:

1. **Enable Organizations API** in the main account:
   - The Lambda function already has `organizations:List*` and `organizations:Describe*` permissions
   - Ensure the Lambda execution role is in the **management account** or has delegated access

2. **No additional configuration needed** - accounts will be discovered automatically

### Option B: Manual Account List

If you're not using Organizations or want to limit which accounts are visible:

1. **Set Environment Variable** in your Lambda function:
   ```bash
   # Format: accountId1:AccountName1,accountId2:AccountName2
   # Or: accountId1,accountId2 (names will be auto-generated)
   
   INVENTORY_ACCOUNTS=123456789012:Production,987654321098:Development,111222333444:Staging
   ```

2. **Update via AWS Console**:
   - Go to Lambda → Your function → Configuration → Environment variables
   - Add `INVENTORY_ACCOUNTS` with your account list

3. **Update via SAM/CloudFormation**:
   - Add to `template.yaml` under `Environment.Variables`:
   ```yaml
   Environment:
     Variables:
       INVENTORY_ACCOUNTS: "123456789012:Production,987654321098:Development"
   ```

## Step 4: Configure External ID (Optional but Recommended)

External ID adds an extra layer of security to prevent confused deputy attacks.

1. **Set External ID** in main account:
   - In your SAM template, set the `ExternalId` parameter
   - Or set environment variable `EXTERNAL_ID` in Lambda

2. **Use Same External ID** in member account roles:
   - When creating the role, check "Require external ID"
   - Use the same value as in the main account

## Step 5: Verify Setup

1. **Test Account Discovery**:
   ```bash
   # Call the accounts endpoint
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://YOUR_API_URL/accounts
   ```

2. **Test Role Assumption**:
   - Use the frontend to select an account
   - Try to load inventory for that account
   - Check CloudWatch logs for any errors

## IAM Policy for Member Account Role

Create this policy and attach it to the `InventoryReadRole` in each member account:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2ReadAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "ec2:GetConsoleOutput",
        "ec2:GetConsoleScreenshot"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3ReadAccess",
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning",
        "s3:GetBucketAcl",
        "s3:GetBucketPolicy",
        "s3:GetBucketEncryption",
        "s3:GetBucketPublicAccessBlock",
        "s3:GetBucketTagging",
        "s3:ListBucket"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RDSReadAccess",
      "Effect": "Allow",
      "Action": [
        "rds:Describe*",
        "rds:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DynamoDBReadAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "dynamodb:ListTagsOfResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMReadAccess",
      "Effect": "Allow",
      "Action": [
        "iam:ListRoles",
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:ListRoleTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "VPCReadAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeInternetGateways",
        "ec2:DescribeNatGateways",
        "ec2:DescribeRouteTables",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeNetworkAcls",
        "ec2:DescribeVpcPeeringConnections"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EKSReadAccess",
      "Effect": "Allow",
      "Action": [
        "eks:ListClusters",
        "eks:DescribeCluster",
        "eks:ListNodegroups",
        "eks:DescribeNodegroup",
        "eks:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECSReadAccess",
      "Effect": "Allow",
      "Action": [
        "ecs:ListClusters",
        "ecs:DescribeClusters",
        "ecs:ListServices",
        "ecs:DescribeServices",
        "ecs:ListTasks",
        "ecs:DescribeTasks",
        "ecs:ListTaskDefinitions",
        "ecs:DescribeTaskDefinitions"
      ],
      "Resource": "*"
    },
    {
      "Sid": "STSReadAccess",
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

## IAM Trust Policy for Member Account Role

The trust policy allows the Lambda function from the main account to assume this role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::MAIN_ACCOUNT_ID:role/aws-inventory-dashboard-InventoryFunctionRole-XXXXXXXX"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR_EXTERNAL_ID"
        }
      }
    }
  ]
}
```

**Important Notes:**
- Replace `MAIN_ACCOUNT_ID` with your main account ID
- Replace `aws-inventory-dashboard-InventoryFunctionRole-XXXXXXXX` with your actual Lambda execution role name
- Replace `YOUR_EXTERNAL_ID` with your external ID (or remove the Condition block if not using external ID)

### Finding Your Lambda Execution Role Name

After deploying with SAM, find the role name:

```bash
# Get the role ARN from CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name aws-inventory-dashboard \
  --query 'Stacks[0].Outputs[?OutputKey==`InventoryFunctionRoleArn`].OutputValue' \
  --output text

# Or list roles and find the one with "InventoryFunction" in the name
aws iam list-roles --query 'Roles[?contains(RoleName, `InventoryFunction`)].Arn' --output text
```

### Simplified Trust Policy (Without External ID)

If you're not using external ID:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::MAIN_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Note**: Using `root` is less secure but simpler. For production, use the specific role ARN.

## CloudFormation Template for Member Account

Save this as `member-account-role.yaml` and deploy in each member account:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: IAM Role for AWS Inventory Dashboard - Member Account

Parameters:
  MainAccountId:
    Type: String
    Description: Main account ID where Lambda function is deployed
    AllowedPattern: '^[0-9]{12}$'
  
  LambdaExecutionRoleName:
    Type: String
    Description: Name of the Lambda execution role in main account (e.g., aws-inventory-dashboard-InventoryFunctionRole-XXXXXXXX)
    Default: ''
  
  ExternalId:
    Type: String
    Description: External ID for additional security (optional)
    Default: ''
    NoEcho: true

Resources:
  InventoryReadRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: InventoryReadRole
      Description: Allows AWS Inventory Dashboard to read resources in this account
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              AWS: !If
                - UseSpecificRole
                - !Sub 'arn:aws:iam::${MainAccountId}:role/${LambdaExecutionRoleName}'
                - !Sub 'arn:aws:iam::${MainAccountId}:root'
            Action: sts:AssumeRole
            Condition: !If
              - UseExternalId
              - StringEquals:
                  sts:ExternalId: !Ref ExternalId
              - !Ref AWS::NoValue
      ManagedPolicyArns: []
      Policies:
        - PolicyName: InventoryReadPolicy
          PolicyDocument:
            Statement:
              - Sid: EC2ReadAccess
                Effect: Allow
                Action:
                  - ec2:Describe*
                  - ec2:GetConsoleOutput
                  - ec2:GetConsoleScreenshot
                Resource: '*'
              - Sid: S3ReadAccess
                Effect: Allow
                Action:
                  - s3:ListAllMyBuckets
                  - s3:GetBucketLocation
                  - s3:GetBucketVersioning
                  - s3:GetBucketAcl
                  - s3:GetBucketPolicy
                  - s3:GetBucketEncryption
                  - s3:GetBucketPublicAccessBlock
                  - s3:GetBucketTagging
                  - s3:ListBucket
                Resource: '*'
              - Sid: RDSReadAccess
                Effect: Allow
                Action:
                  - rds:Describe*
                  - rds:ListTagsForResource
                Resource: '*'
              - Sid: DynamoDBReadAccess
                Effect: Allow
                Action:
                  - dynamodb:ListTables
                  - dynamodb:DescribeTable
                  - dynamodb:ListTagsOfResource
                Resource: '*'
              - Sid: IAMReadAccess
                Effect: Allow
                Action:
                  - iam:ListRoles
                  - iam:GetRole
                  - iam:GetRolePolicy
                  - iam:ListRolePolicies
                  - iam:ListAttachedRolePolicies
                  - iam:ListRoleTags
                Resource: '*'
              - Sid: VPCReadAccess
                Effect: Allow
                Action:
                  - ec2:DescribeVpcs
                  - ec2:DescribeSubnets
                  - ec2:DescribeInternetGateways
                  - ec2:DescribeNatGateways
                  - ec2:DescribeRouteTables
                  - ec2:DescribeSecurityGroups
                  - ec2:DescribeNetworkAcls
                  - ec2:DescribeVpcPeeringConnections
                Resource: '*'
              - Sid: EKSReadAccess
                Effect: Allow
                Action:
                  - eks:ListClusters
                  - eks:DescribeCluster
                  - eks:ListNodegroups
                  - eks:DescribeNodegroup
                  - eks:ListTagsForResource
                Resource: '*'
              - Sid: ECSReadAccess
                Effect: Allow
                Action:
                  - ecs:ListClusters
                  - ecs:DescribeClusters
                  - ecs:ListServices
                  - ecs:DescribeServices
                  - ecs:ListTasks
                  - ecs:DescribeTasks
                  - ecs:ListTaskDefinitions
                  - ecs:DescribeTaskDefinitions
                Resource: '*'
              - Sid: STSReadAccess
                Effect: Allow
                Action:
                  - sts:GetCallerIdentity
                Resource: '*'

Conditions:
  UseExternalId: !Not [!Equals [!Ref ExternalId, '']]
  UseSpecificRole: !Not [!Equals [!Ref LambdaExecutionRoleName, '']]

Outputs:
  RoleArn:
    Description: ARN of the created role
    Value: !GetAtt InventoryReadRole.Arn
    Export:
      Name: !Sub '${AWS::StackName}-InventoryReadRoleArn'
```

**Deploy in member account:**
```bash
aws cloudformation create-stack \
  --stack-name inventory-read-role \
  --template-body file://member-account-role.yaml \
  --parameters \
    ParameterKey=MainAccountId,ParameterValue=123456789012 \
    ParameterKey=LambdaExecutionRoleName,ParameterValue=aws-inventory-dashboard-InventoryFunctionRole-XXXXXXXX \
    ParameterKey=ExternalId,ParameterValue=your-external-id-here \
  --capabilities CAPABILITY_NAMED_IAM
```

## AWS CLI Scripts

### Create Role in Member Account (Bash)

```bash
#!/bin/bash

# Configuration
MAIN_ACCOUNT_ID="123456789012"
LAMBDA_ROLE_NAME="aws-inventory-dashboard-InventoryFunctionRole-XXXXXXXX"
EXTERNAL_ID="your-external-id-here"  # Optional, leave empty if not using
MEMBER_ACCOUNT_ID="987654321098"
ROLE_NAME="InventoryReadRole"

# Create trust policy
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${MAIN_ACCOUNT_ID}:role/${LAMBDA_ROLE_NAME}"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "${EXTERNAL_ID}"
        }
      }
    }
  ]
}
EOF
)

# Create role
aws iam create-role \
  --role-name ${ROLE_NAME} \
  --assume-role-policy-document "${TRUST_POLICY}" \
  --description "Allows inventory dashboard to read resources"

# Attach permissions (save the policy JSON to a file first)
aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name InventoryReadPolicy \
  --policy-document file://inventory-read-policy.json

echo "Role created: arn:aws:iam::${MEMBER_ACCOUNT_ID}:role/${ROLE_NAME}"
```

### Create Role in Member Account (PowerShell)

```powershell
# Configuration
$MainAccountId = "123456789012"
$LambdaRoleName = "aws-inventory-dashboard-InventoryFunctionRole-XXXXXXXX"
$ExternalId = "your-external-id-here"  # Optional
$MemberAccountId = "987654321098"
$RoleName = "InventoryReadRole"

# Create trust policy
$TrustPolicy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Principal = @{
                AWS = "arn:aws:iam::${MainAccountId}:role/${LambdaRoleName}"
            }
            Action = "sts:AssumeRole"
            Condition = @{
                StringEquals = @{
                    "sts:ExternalId" = $ExternalId
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

# Create role
New-IAMRole -RoleName $RoleName -AssumeRolePolicyDocument $TrustPolicy -Description "Allows inventory dashboard to read resources"

# Attach permissions (read policy from file)
$PolicyDocument = Get-Content -Path "inventory-read-policy.json" -Raw
Write-IAMRolePolicy -RoleName $RoleName -PolicyName "InventoryReadPolicy" -PolicyDocument $PolicyDocument

Write-Host "Role created: arn:aws:iam::${MemberAccountId}:role/${RoleName}"
```

## Troubleshooting

### Issue: "Access Denied" when assuming role

**Solutions:**
1. Verify the trust policy allows the Lambda execution role
2. Check if external ID matches (if using)
3. Ensure the role name matches `InventoryRoleName` parameter
4. Verify the Lambda execution role has `sts:AssumeRole` permission

### Issue: Accounts not showing in frontend

**Solutions:**
1. Check if `INVENTORY_ACCOUNTS` environment variable is set correctly
2. Verify AWS Organizations access (if using Organizations)
3. Check CloudWatch logs for errors
4. Ensure the `/accounts` endpoint is accessible

### Issue: "Failed to assume role" errors

**Solutions:**
1. Verify the role exists in the member account
2. Check the role ARN format: `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`
3. Verify trust policy allows the main account
4. Check external ID matches (if using)
5. Review CloudWatch logs for detailed error messages

### Issue: No resources found in member account

**Solutions:**
1. Verify the role has the correct permissions
2. Check if resources exist in the selected regions
3. Review CloudWatch logs for collection errors
4. Test role assumption manually:
   ```bash
   aws sts assume-role \
     --role-arn arn:aws:iam::MEMBER_ACCOUNT_ID:role/InventoryReadRole \
     --role-session-name test-session \
     --external-id YOUR_EXTERNAL_ID
   ```

## Security Best Practices

1. **Use External ID**: Always use external ID for cross-account roles
2. **Least Privilege**: The role only has read permissions
3. **Specific Role ARN**: Use specific Lambda role ARN instead of account root
4. **Monitor Access**: Enable CloudTrail to monitor role assumptions
5. **Regular Audits**: Review role usage and permissions regularly

## Next Steps

1. Create the role in each member account
2. Configure account discovery (Organizations or manual list)
3. Test account selection in the frontend
4. Verify inventory collection from member accounts
5. Monitor CloudWatch logs for any issues

## Additional Resources

- [AWS IAM Cross-Account Roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_aws-accounts.html)
- [AWS STS AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
- [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/)

