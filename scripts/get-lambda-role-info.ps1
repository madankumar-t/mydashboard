# PowerShell script to get Lambda execution role information for multi-account setup
# Usage: .\get-lambda-role-info.ps1 [STACK_NAME]

param(
    [Parameter(Mandatory=$false)]
    [string]$StackName = "aws-inventory-dashboard"
)

Write-Output "Finding Lambda execution role information..."
Write-Output ""

# Try to get from CloudFormation stack
Write-Output "Checking CloudFormation stack: $StackName"
try {
    $Resources = Get-CFNStackResource -StackName $StackName -ErrorAction Stop
    $RoleResource = $Resources | Where-Object { $_.ResourceType -eq "AWS::IAM::Role" } | Select-Object -First 1
    
    if ($RoleResource) {
        $RoleArn = $RoleResource.PhysicalResourceId
        Write-Output "✓ Found role ARN from CloudFormation:"
        Write-Output "  $RoleArn"
        Write-Output ""
        
        $RoleName = $RoleArn.Split('/')[-1]
        Write-Output "Role Name: $RoleName"
        Write-Output ""
    } else {
        throw "No role found in stack"
    }
} catch {
    Write-Output "Could not find role in CloudFormation. Searching IAM..."
    Write-Output ""
    
    # Search IAM for roles containing InventoryFunction
    try {
        $Roles = Get-IAMRoleList
        $Role = $Roles | Where-Object { $_.RoleName -like "*InventoryFunction*" } | Select-Object -First 1
        
        if ($Role) {
            $RoleArn = $Role.Arn
            Write-Output "✓ Found role ARN from IAM:"
            Write-Output "  $RoleArn"
            Write-Output ""
            
            $RoleName = $Role.RoleName
            Write-Output "Role Name: $RoleName"
            Write-Output ""
        } else {
            throw "No role found"
        }
    } catch {
        Write-Output "✗ Could not find Lambda execution role."
        Write-Output ""
        Write-Output "Try:"
        Write-Output "  1. Check if the stack is deployed: Get-CFNStack -StackName $StackName"
        Write-Output "  2. List all roles: Get-IAMRoleList"
        exit 1
    }
}

# Get account ID
try {
    $AccountId = (Get-STSCallerIdentity).Account
    Write-Output "Main Account ID: $AccountId"
    Write-Output ""
} catch {
    Write-Output "Could not get account ID"
}

Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output "Use this information in member account trust policies:"
Write-Output ""
Write-Output "Trust Policy Principal (Option 1 - Specific Role - Recommended):"
Write-Output '  "Principal": {'
Write-Output "    `"AWS`": `"$RoleArn`""
Write-Output "  }"
Write-Output ""
Write-Output "Trust Policy Principal (Option 2 - Account Root - Less Secure):"
Write-Output '  "Principal": {'
Write-Output "    `"AWS`": `"arn:aws:iam::${AccountId}:root`""
Write-Output "  }"
Write-Output ""
Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

