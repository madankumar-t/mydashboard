# PowerShell script to create IAM role in member account for AWS Inventory Dashboard
# Usage: .\create-member-account-role.ps1 -MemberAccountId <ACCOUNT_ID> [-MainAccountId <ACCOUNT_ID>] [-ExternalId <ID>]

param(
    [Parameter(Mandatory=$true)]
    [string]$MemberAccountId,
    
    [Parameter(Mandatory=$false)]
    [string]$MainAccountId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ExternalId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$RoleName = "InventoryReadRole"
)

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Validate inputs
if ([string]::IsNullOrEmpty($MainAccountId)) {
    Write-ColorOutput Yellow "Warning: Main account ID not provided. Attempting to detect..."
    try {
        $MainAccountId = (Get-STSCallerIdentity).Account
    } catch {
        Write-ColorOutput Red "Error: Could not detect main account ID. Please provide it."
        Write-Output "Usage: .\create-member-account-role.ps1 -MemberAccountId <ACCOUNT_ID> -MainAccountId <ACCOUNT_ID> [-ExternalId <ID>]"
        exit 1
    }
}

Write-ColorOutput Green "Creating IAM role in member account..."
Write-Output "Member Account ID: $MemberAccountId"
Write-Output "Main Account ID: $MainAccountId"
Write-Output "Role Name: $RoleName"
if (-not [string]::IsNullOrEmpty($ExternalId)) {
    Write-Output "External ID: *** (hidden)"
}
Write-Output ""

# Get Lambda execution role name (try to detect)
Write-ColorOutput Yellow "Attempting to detect Lambda execution role name..."
try {
    $LambdaRoleName = (Get-IAMRoleList | Where-Object { $_.RoleName -like "*InventoryFunction*" } | Select-Object -First 1).RoleName
    if ([string]::IsNullOrEmpty($LambdaRoleName)) {
        Write-ColorOutput Yellow "Could not auto-detect Lambda role. Using account root in trust policy."
        $LambdaRoleName = ""
    }
} catch {
    Write-ColorOutput Yellow "Could not auto-detect Lambda role. Using account root in trust policy."
    $LambdaRoleName = ""
}

# Create trust policy
$TrustPolicy = @{
    Version = "2012-10-17"
    Statement = @()
}

$Principal = @{}
if (-not [string]::IsNullOrEmpty($LambdaRoleName)) {
    $Principal.AWS = "arn:aws:iam::${MainAccountId}:role/${LambdaRoleName}"
} else {
    $Principal.AWS = "arn:aws:iam::${MainAccountId}:root"
}

$Statement = @{
    Effect = "Allow"
    Principal = $Principal
    Action = "sts:AssumeRole"
}

if (-not [string]::IsNullOrEmpty($ExternalId)) {
    $Statement.Condition = @{
        StringEquals = @{
            "sts:ExternalId" = $ExternalId
        }
    }
}

$TrustPolicy.Statement = @($Statement)
$TrustPolicyJson = $TrustPolicy | ConvertTo-Json -Depth 10

# Create the role
Write-ColorOutput Green "Creating IAM role..."
try {
    New-IAMRole -RoleName $RoleName -AssumeRolePolicyDocument $TrustPolicyJson -Description "Allows AWS Inventory Dashboard to read resources in this account" -ErrorAction Stop
    Write-ColorOutput Green "Role created successfully."
} catch {
    if ($_.Exception.Message -like "*already exists*") {
        Write-ColorOutput Yellow "Role already exists. Updating trust policy..."
        Update-IAMAssumeRolePolicy -RoleName $RoleName -PolicyDocument $TrustPolicyJson
    } else {
        Write-ColorOutput Red "Failed to create role: $($_.Exception.Message)"
        exit 1
    }
}

# Create inline policy
Write-ColorOutput Green "Attaching permissions policy..."
$PolicyDocument = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Sid = "EC2ReadAccess"
            Effect = "Allow"
            Action = @("ec2:Describe*", "ec2:GetConsoleOutput", "ec2:GetConsoleScreenshot")
            Resource = "*"
        },
        @{
            Sid = "S3ReadAccess"
            Effect = "Allow"
            Action = @(
                "s3:ListAllMyBuckets",
                "s3:GetBucketLocation",
                "s3:GetBucketVersioning",
                "s3:GetBucketAcl",
                "s3:GetBucketPolicy",
                "s3:GetBucketEncryption",
                "s3:GetBucketPublicAccessBlock",
                "s3:GetBucketTagging",
                "s3:ListBucket"
            )
            Resource = "*"
        },
        @{
            Sid = "RDSReadAccess"
            Effect = "Allow"
            Action = @("rds:Describe*", "rds:ListTagsForResource")
            Resource = "*"
        },
        @{
            Sid = "DynamoDBReadAccess"
            Effect = "Allow"
            Action = @("dynamodb:ListTables", "dynamodb:DescribeTable", "dynamodb:ListTagsOfResource")
            Resource = "*"
        },
        @{
            Sid = "IAMReadAccess"
            Effect = "Allow"
            Action = @(
                "iam:ListRoles",
                "iam:GetRole",
                "iam:GetRolePolicy",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies",
                "iam:ListRoleTags"
            )
            Resource = "*"
        },
        @{
            Sid = "VPCReadAccess"
            Effect = "Allow"
            Action = @(
                "ec2:DescribeVpcs",
                "ec2:DescribeSubnets",
                "ec2:DescribeInternetGateways",
                "ec2:DescribeNatGateways",
                "ec2:DescribeRouteTables",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeNetworkAcls",
                "ec2:DescribeVpcPeeringConnections"
            )
            Resource = "*"
        },
        @{
            Sid = "EKSReadAccess"
            Effect = "Allow"
            Action = @(
                "eks:ListClusters",
                "eks:DescribeCluster",
                "eks:ListNodegroups",
                "eks:DescribeNodegroup",
                "eks:ListTagsForResource"
            )
            Resource = "*"
        },
        @{
            Sid = "ECSReadAccess"
            Effect = "Allow"
            Action = @(
                "ecs:ListClusters",
                "ecs:DescribeClusters",
                "ecs:ListServices",
                "ecs:DescribeServices",
                "ecs:ListTasks",
                "ecs:DescribeTasks",
                "ecs:ListTaskDefinitions",
                "ecs:DescribeTaskDefinitions"
            )
            Resource = "*"
        },
        @{
            Sid = "STSReadAccess"
            Effect = "Allow"
            Action = @("sts:GetCallerIdentity")
            Resource = "*"
        }
    )
} | ConvertTo-Json -Depth 10

Write-IAMRolePolicy -RoleName $RoleName -PolicyName "InventoryReadPolicy" -PolicyDocument $PolicyDocument

Write-ColorOutput Green "✓ Role created successfully!"
Write-Output ""
Write-Output "Role ARN: arn:aws:iam::${MemberAccountId}:role/${RoleName}"
Write-Output ""
Write-ColorOutput Yellow "Next steps:"
Write-Output "1. Verify the role in AWS Console: https://console.aws.amazon.com/iam/home#/roles/${RoleName}"
Write-Output "2. Add this account to INVENTORY_ACCOUNTS environment variable in Lambda (if not using Organizations)"
Write-Output "3. Test account access in the dashboard"

