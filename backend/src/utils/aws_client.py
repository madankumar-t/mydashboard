"""
AWS Client Utilities
Handles multi-account and multi-region AWS client creation

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

import boto3
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import os


class AWSClientManager:
    """Manages AWS client creation with multi-account and multi-region support"""
    
    # AWS regions list
    AWS_REGIONS = [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
        'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
        'ap-south-1', 'ca-central-1', 'sa-east-1'
    ]
    
    def __init__(self):
        self.external_id = os.environ.get('EXTERNAL_ID', '')
        self.role_session_name = os.environ.get('ROLE_SESSION_NAME', 'InventoryDashboard')
    
    def get_sts_client(self, region: str = 'us-east-1'):
        """Get STS client for assuming roles"""
        return boto3.client('sts', region_name=region)
    
    def assume_role(self, role_arn: str, region: str = 'us-east-1') -> Dict[str, Any]:
        """
        Assume role in target account
        
        Args:
            role_arn: ARN of the role to assume (e.g., arn:aws:iam::123456789012:role/InventoryReadRole)
            region: AWS region
            
        Returns:
            Credentials dict with AccessKeyId, SecretAccessKey, SessionToken
        """
        sts = self.get_sts_client(region)
        
        try:
            assume_role_kwargs = {
                'RoleArn': role_arn,
                'RoleSessionName': self.role_session_name
            }
            
            # Add ExternalId if configured (recommended for security)
            if self.external_id:
                assume_role_kwargs['ExternalId'] = self.external_id
            
            response = sts.assume_role(**assume_role_kwargs)
            return response['Credentials']
        except Exception as e:
            print(f"Failed to assume role {role_arn}: {str(e)}")
            raise
    
    def get_client(
        self,
        service: str,
        region: str = 'us-east-1',
        account_id: Optional[str] = None,
        role_arn: Optional[str] = None
    ):
        """
        Get AWS service client
        
        Args:
            service: AWS service name (e.g., 'ec2', 's3')
            region: AWS region
            account_id: Target account ID (for multi-account)
            role_arn: Role ARN to assume (if account_id is provided)
            
        Returns:
            Boto3 client for the service
        """
        kwargs = {'region_name': region}
        
        # If account_id and role_arn are provided, assume role
        if account_id and role_arn:
            credentials = self.assume_role(role_arn, region)
            kwargs['aws_access_key_id'] = credentials['AccessKeyId']
            kwargs['aws_secret_access_key'] = credentials['SecretAccessKey']
            kwargs['aws_session_token'] = credentials['SessionToken']
        
        return boto3.client(service, **kwargs)
    
    def get_clients_for_regions(
        self,
        service: str,
        regions: List[str],
        account_id: Optional[str] = None,
        role_arn: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get clients for multiple regions
        
        Args:
            service: AWS service name
            regions: List of regions
            account_id: Target account ID (for multi-account)
            role_arn: Role ARN to assume
            
        Returns:
            Dict mapping region -> client
        """
        clients = {}
        
        # For IAM (global service), only need one client
        if service.lower() == 'iam':
            # IAM is global, use us-east-1
            region = 'us-east-1'
            try:
                clients[region] = self.get_client(service, region, account_id, role_arn)
            except Exception as e:
                print(f"Failed to create {service} client for {region}: {str(e)}")
            return clients
        
        # For regional services, create clients for each region
        for region in regions:
            try:
                clients[region] = self.get_client(service, region, account_id, role_arn)
            except Exception as e:
                print(f"Failed to create {service} client for {region} (account: {account_id}): {str(e)}")
                # Continue with other regions even if one fails
        
        return clients
    
    def get_accounts_from_org(self) -> List[Dict[str, str]]:
        """
        Get list of accounts from AWS Organizations
        
        Priority:
        1. AWS Organizations API (if available)
        2. Environment variable INVENTORY_ACCOUNTS (comma-separated account IDs)
        3. Current account (fallback)
        
        Returns:
            List of dicts with accountId and accountName
        """
        # Try AWS Organizations first
        try:
            orgs = boto3.client('organizations', region_name='us-east-1')
            accounts = []
            
            paginator = orgs.get_paginator('list_accounts')
            for page in paginator.paginate():
                for account in page['Accounts']:
                    if account['Status'] == 'ACTIVE':
                        accounts.append({
                            'accountId': account['Id'],
                            'accountName': account['Name']
                        })
            
            if accounts:
                print(f"Found {len(accounts)} accounts from AWS Organizations")
                return accounts
        except Exception as e:
            print(f"Failed to list accounts from Organizations: {str(e)}")
        
        # Fallback: Check for hardcoded accounts in environment variable
        # Format: "accountId1:AccountName1,accountId2:AccountName2" or "accountId1,accountId2"
        hardcoded_accounts = os.environ.get('INVENTORY_ACCOUNTS', '')
        if hardcoded_accounts:
            accounts = []
            for account_str in hardcoded_accounts.split(','):
                account_str = account_str.strip()
                if ':' in account_str:
                    # Format: accountId:AccountName
                    account_id, account_name = account_str.split(':', 1)
                    accounts.append({
                        'accountId': account_id.strip(),
                        'accountName': account_name.strip()
                    })
                else:
                    # Format: accountId only
                    accounts.append({
                        'accountId': account_str.strip(),
                        'accountName': f"Account {account_str.strip()}"
                    })
            
            if accounts:
                print(f"Using {len(accounts)} accounts from INVENTORY_ACCOUNTS environment variable")
                return accounts
        
        # Final fallback: Current account
        try:
            sts = boto3.client('sts', region_name='us-east-1')
            current_account = sts.get_caller_identity()
            account_id = current_account['Account']
            print(f"Using current account: {account_id}")
            return [{
                'accountId': account_id,
                'accountName': 'Current Account'
            }]
        except Exception as e:
            print(f"Failed to get current account: {str(e)}")
            return []
    
    def build_role_arn(self, account_id: str, role_name: str = 'InventoryReadRole') -> str:
        """Build role ARN for an account"""
        return f"arn:aws:iam::{account_id}:role/{role_name}"


# Global instance
client_manager = AWSClientManager()

