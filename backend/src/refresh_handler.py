"""
Refresh Handler - Collects inventory from AWS and stores in DynamoDB

This Lambda function can be triggered:
1. On-demand via API endpoint
2. Scheduled via EventBridge (daily)

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

import json
import os
import sys
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import boto3

# Add src to path for Lambda
sys.path.insert(0, os.path.dirname(__file__))

from utils.aws_client import client_manager, AWSClientManager
from utils.dynamodb_storage import storage
from collectors import COLLECTORS
from utils.response import success_response, error_response


def collect_and_store_inventory(
    service: str,
    account_id: str,
    role_arn: Optional[str],
    regions: List[str]
) -> Dict[str, Any]:
    """
    Collect inventory for a service and store in DynamoDB
    
    Args:
        service: Service name (e.g., 'ec2', 's3')
        account_id: AWS account ID
        role_arn: Optional role ARN to assume
        regions: List of regions to collect from
        
    Returns:
        Dict with collection results
    """
    if service not in COLLECTORS:
        raise ValueError(f"Unsupported service: {service}")
    
    collector_class = COLLECTORS[service]
    collector = collector_class()
    
    all_resources = []
    errors = []
    
    try:
        # Get clients for all regions
        clients = client_manager.get_clients_for_regions(
            service,
            regions,
            account_id,
            role_arn
        )
        
        if not clients:
            error_msg = f"No clients created for account {account_id}, service {service}"
            print(f"Warning: {error_msg}")
            errors.append(error_msg)
            return {
                'service': service,
                'accountId': account_id,
                'resourceCount': 0,
                'errors': errors
            }
        
        # Collect resources from all regions
        resources = collector.collect_multi_region(clients, regions, account_id)
        
        # Store resources in DynamoDB by region
        timestamp = datetime.now(timezone.utc)
        for region in regions:
            region_resources = [r for r in resources if r.get('region') == region]
            if region_resources:
                try:
                    storage.store_resources(
                        service=service,
                        account_id=account_id,
                        region=region,
                        resources=region_resources,
                        timestamp=timestamp
                    )
                    all_resources.extend(region_resources)
                    print(f"Stored {len(region_resources)} {service} resources for {account_id}/{region}")
                except Exception as e:
                    error_msg = f"Error storing {service} resources for {account_id}/{region}: {str(e)}"
                    print(error_msg)
                    errors.append(error_msg)
        
        return {
            'service': service,
            'accountId': account_id,
            'resourceCount': len(all_resources),
            'regions': regions,
            'errors': errors
        }
    except Exception as e:
        error_msg = f"Error collecting {service} from account {account_id}: {str(e)}"
        print(error_msg)
        errors.append(error_msg)
        return {
            'service': service,
            'accountId': account_id,
            'resourceCount': 0,
            'errors': errors
        }


def refresh_all_services(account_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Refresh inventory for all services and accounts
    
    Args:
        account_ids: Optional list of account IDs to refresh (defaults to all)
        
    Returns:
        Dict with refresh results
    """
    # Get accounts if not provided
    if account_ids is None:
        accounts = client_manager.get_accounts_from_org()
        account_ids = [acc['accountId'] for acc in accounts]
    
    if not account_ids:
        # Fallback to current account
        try:
            sts = boto3.client('sts', region_name='us-east-1')
            current_account = sts.get_caller_identity()
            account_ids = [current_account['Account']]
        except Exception as e:
            print(f"Failed to get current account: {str(e)}")
            return {
                'success': False,
                'error': 'No accounts available'
            }
    
    results = []
    role_name = os.environ.get('INVENTORY_ROLE_NAME', 'InventoryReadRole')
    
    # Refresh all services for all accounts
    for account_id in account_ids:
        role_arn = client_manager.build_role_arn(account_id, role_name) if account_id else None
        
        for service in COLLECTORS.keys():
            # Get regions for this service
            if service.lower() == 'iam':
                regions = ['us-east-1']  # IAM is global
            else:
                regions = AWSClientManager.AWS_REGIONS
            
            result = collect_and_store_inventory(
                service=service,
                account_id=account_id,
                role_arn=role_arn if account_id else None,
                regions=regions
            )
            results.append(result)
    
    total_resources = sum(r.get('resourceCount', 0) for r in results)
    all_errors = []
    for r in results:
        all_errors.extend(r.get('errors', []))
    
    return {
        'success': True,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'totalResources': total_resources,
        'results': results,
        'errors': all_errors
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for refresh function
    
    Can be triggered by:
    1. API Gateway (on-demand refresh)
    2. EventBridge (scheduled refresh)
    """
    print(f"Refresh handler invoked: {json.dumps(event)}")
    
    try:
        # Check if triggered by API Gateway
        if 'httpMethod' in event:
            # Handle CORS preflight
            if event.get("httpMethod") == "OPTIONS":
                from utils.response import cors_preflight
                return cors_preflight()
            
            # Parse query parameters
            params = event.get("queryStringParameters") or {}
            service = params.get("service", "").lower()
            account_ids_param = params.get("accounts", "")
            
            account_ids = None
            if account_ids_param:
                account_ids = [a.strip() for a in account_ids_param.split(',') if a.strip()]
            
            # Refresh specific service or all services
            if service and service in COLLECTORS:
                # Refresh single service
                if not account_ids:
                    accounts = client_manager.get_accounts_from_org()
                    account_ids = [acc['accountId'] for acc in accounts]
                
                if not account_ids:
                    try:
                        sts = boto3.client('sts', region_name='us-east-1')
                        current_account = sts.get_caller_identity()
                        account_ids = [current_account['Account']]
                    except Exception:
                        return error_response("No accounts available", 400)
                
                results = []
                role_name = os.environ.get('INVENTORY_ROLE_NAME', 'InventoryReadRole')
                
                for account_id in account_ids:
                    role_arn = client_manager.build_role_arn(account_id, role_name) if account_id else None
                    
                    if service.lower() == 'iam':
                        regions = ['us-east-1']
                    else:
                        regions = AWSClientManager.AWS_REGIONS
                    
                    result = collect_and_store_inventory(
                        service=service,
                        account_id=account_id,
                        role_arn=role_arn if account_id else None,
                        regions=regions
                    )
                    results.append(result)
                
                total_resources = sum(r.get('resourceCount', 0) for r in results)
                return success_response({
                    'service': service,
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'totalResources': total_resources,
                    'results': results
                })
            else:
                # Refresh all services
                result = refresh_all_services(account_ids)
                return success_response(result)
        
        # Check if triggered by EventBridge (scheduled)
        elif 'source' in event and event.get('source') == 'aws.events':
            print("Triggered by EventBridge schedule - refreshing all services")
            result = refresh_all_services()
            return {
                'statusCode': 200,
                'body': json.dumps(result)
            }
        
        # Default: refresh all
        else:
            result = refresh_all_services()
            return {
                'statusCode': 200,
                'body': json.dumps(result)
            }
    
    except Exception as e:
        print(f"Error in refresh handler: {str(e)}")
        import traceback
        traceback.print_exc()
        error_details = str(e) if os.environ.get("ENVIRONMENT") != "prod" else None
        return error_response("Refresh failed", 500, error_details, error_code="REFRESH_ERROR")

