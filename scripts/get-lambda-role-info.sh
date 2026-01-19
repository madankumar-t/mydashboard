#!/bin/bash

# Script to get Lambda execution role information for multi-account setup
# Usage: ./get-lambda-role-info.sh [STACK_NAME]

STACK_NAME="${1:-aws-inventory-dashboard}"

echo "Finding Lambda execution role information..."
echo ""

# Try to get from CloudFormation stack
echo "Checking CloudFormation stack: $STACK_NAME"
ROLE_ARN=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --query 'StackResources[?ResourceType==`AWS::IAM::Role`].PhysicalResourceId' \
  --output text 2>/dev/null | head -n1)

if [ -n "$ROLE_ARN" ]; then
    echo "✓ Found role ARN from CloudFormation:"
    echo "  $ROLE_ARN"
    echo ""
    
    # Extract role name from ARN
    ROLE_NAME=$(echo "$ROLE_ARN" | sed 's/.*\///')
    echo "Role Name: $ROLE_NAME"
    echo ""
else
    echo "Could not find role in CloudFormation. Searching IAM..."
    echo ""
    
    # Search IAM for roles containing InventoryFunction
    ROLE_ARN=$(aws iam list-roles \
      --query 'Roles[?contains(RoleName, `InventoryFunction`)].Arn' \
      --output text 2>/dev/null | head -n1)
    
    if [ -n "$ROLE_ARN" ]; then
        echo "✓ Found role ARN from IAM:"
        echo "  $ROLE_ARN"
        echo ""
        
        ROLE_NAME=$(echo "$ROLE_ARN" | sed 's/.*\///')
        echo "Role Name: $ROLE_NAME"
        echo ""
    else
        echo "✗ Could not find Lambda execution role."
        echo ""
        echo "Try:"
        echo "  1. Check if the stack is deployed: aws cloudformation describe-stacks --stack-name $STACK_NAME"
        echo "  2. List all roles: aws iam list-roles --query 'Roles[].RoleName' --output table"
        exit 1
    fi
fi

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -n "$ACCOUNT_ID" ]; then
    echo "Main Account ID: $ACCOUNT_ID"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Use this information in member account trust policies:"
echo ""
echo "Trust Policy Principal (Option 1 - Specific Role - Recommended):"
echo "  \"Principal\": {"
echo "    \"AWS\": \"$ROLE_ARN\""
echo "  }"
echo ""
echo "Trust Policy Principal (Option 2 - Account Root - Less Secure):"
echo "  \"Principal\": {"
echo "    \"AWS\": \"arn:aws:iam::${ACCOUNT_ID}:root\""
echo "  }"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

