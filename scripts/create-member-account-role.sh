#!/bin/bash

# Script to create IAM role in member account for AWS Inventory Dashboard
# Usage: ./create-member-account-role.sh <MEMBER_ACCOUNT_ID> [MAIN_ACCOUNT_ID] [EXTERNAL_ID]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MEMBER_ACCOUNT_ID="${1}"
MAIN_ACCOUNT_ID="${2:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '')}"
EXTERNAL_ID="${3:-''}"
ROLE_NAME="InventoryReadRole"

# Validate inputs
if [ -z "$MEMBER_ACCOUNT_ID" ]; then
    echo -e "${RED}Error: Member account ID is required${NC}"
    echo "Usage: $0 <MEMBER_ACCOUNT_ID> [MAIN_ACCOUNT_ID] [EXTERNAL_ID]"
    exit 1
fi

if [ -z "$MAIN_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}Warning: Main account ID not provided. Attempting to detect...${NC}"
    MAIN_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '')
    
    if [ -z "$MAIN_ACCOUNT_ID" ]; then
        echo -e "${RED}Error: Could not detect main account ID. Please provide it as second argument.${NC}"
        echo "Usage: $0 <MEMBER_ACCOUNT_ID> <MAIN_ACCOUNT_ID> [EXTERNAL_ID]"
        exit 1
    fi
fi

echo -e "${GREEN}Creating IAM role in member account...${NC}"
echo "Member Account ID: $MEMBER_ACCOUNT_ID"
echo "Main Account ID: $MAIN_ACCOUNT_ID"
echo "Role Name: $ROLE_NAME"
if [ -n "$EXTERNAL_ID" ]; then
    echo "External ID: $EXTERNAL_ID (hidden)"
fi
echo ""

# Get Lambda execution role name (try to detect)
echo -e "${YELLOW}Attempting to detect Lambda execution role name...${NC}"
LAMBDA_ROLE_NAME=$(aws iam list-roles --query 'Roles[?contains(RoleName, `InventoryFunction`)].RoleName' --output text 2>/dev/null | head -n1 || echo '')

if [ -z "$LAMBDA_ROLE_NAME" ]; then
    echo -e "${YELLOW}Could not auto-detect Lambda role. Using account root in trust policy.${NC}"
    LAMBDA_ROLE_NAME=""
fi

# Create trust policy
if [ -n "$EXTERNAL_ID" ] && [ -n "$LAMBDA_ROLE_NAME" ]; then
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
elif [ -n "$EXTERNAL_ID" ]; then
    TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${MAIN_ACCOUNT_ID}:root"
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
elif [ -n "$LAMBDA_ROLE_NAME" ]; then
    TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${MAIN_ACCOUNT_ID}:role/${LAMBDA_ROLE_NAME}"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)
else
    TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${MAIN_ACCOUNT_ID}:root"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)
fi

# Create the role
echo -e "${GREEN}Creating IAM role...${NC}"
aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "Allows AWS Inventory Dashboard to read resources in this account" \
    --output json > /dev/null 2>&1 || {
    if aws iam get-role --role-name "$ROLE_NAME" > /dev/null 2>&1; then
        echo -e "${YELLOW}Role already exists. Updating trust policy...${NC}"
        aws iam update-assume-role-policy \
            --role-name "$ROLE_NAME" \
            --policy-document "$TRUST_POLICY" > /dev/null
    else
        echo -e "${RED}Failed to create role${NC}"
        exit 1
    fi
}

# Create inline policy
echo -e "${GREEN}Attaching permissions policy...${NC}"
POLICY_DOCUMENT=$(cat <<'EOF'
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
EOF
)

aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name InventoryReadPolicy \
    --policy-document "$POLICY_DOCUMENT" > /dev/null

echo -e "${GREEN}✓ Role created successfully!${NC}"
echo ""
echo "Role ARN: arn:aws:iam::${MEMBER_ACCOUNT_ID}:role/${ROLE_NAME}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify the role in AWS Console: https://console.aws.amazon.com/iam/home#/roles/${ROLE_NAME}"
echo "2. Add this account to INVENTORY_ACCOUNTS environment variable in Lambda (if not using Organizations)"
echo "3. Test account access in the dashboard"

