"""
AWS Inventory Dashboard - Main Lambda Handler
Enterprise-grade multi-account, multi-region inventory collection

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

import json
import os
import sys
from typing import Dict, Any, List, Optional
import boto3

# Add src to path for Lambda
sys.path.insert(0, os.path.dirname(__file__))

from utils.response import success_response, error_response, cors_preflight
from utils.auth import extract_groups_from_claims, can_access_service
from utils.aws_client import client_manager, AWSClientManager
from collectors import COLLECTORS


def get_regions_from_params(params: Dict[str, Any], service: Optional[str] = None) -> List[str]:
    """
    Parse regions from query parameters
    
    Args:
        params: Query parameters
        service: Service name (for global services like IAM)
        
    Returns:
        List of regions to query
    """
    # IAM is global - only need one region (us-east-1) for IAM client
    if service and service.lower() == 'iam':
        return ['us-east-1']  # IAM endpoint is in us-east-1
    
    regions_param = params.get('regions', '')
    if regions_param:
        regions = [r.strip() for r in regions_param.split(',') if r.strip()]
        # Validate regions
        valid_regions = [r for r in regions if r in AWSClientManager.AWS_REGIONS]
        if valid_regions:
            return valid_regions
    
    # Default to all regions if no specific region requested
    # This allows querying all regions when none specified
    return AWSClientManager.AWS_REGIONS


def get_accounts_from_params(params: Dict[str, Any]) -> List[Dict[str, str]]:
    """Parse accounts from query parameters"""
    accounts_param = params.get('accounts', '')
    if accounts_param:
        account_ids = [a.strip() for a in accounts_param.split(',') if a.strip()]
        # Build account list with role ARNs
        role_name = os.environ.get('INVENTORY_ROLE_NAME', 'InventoryReadRole')
        return [
            {
                'accountId': acc_id,
                'roleArn': client_manager.build_role_arn(acc_id, role_name)
            }
            for acc_id in account_ids
        ]
    
    # Default to current account
    return []


def collect_inventory(
    service: str,
    regions: List[str],
    accounts: List[Dict[str, str]],
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Collect inventory across multiple accounts and regions
    
    Args:
        service: Service name (e.g., 'ec2', 's3')
        regions: List of regions to query
        accounts: List of account dicts with accountId and roleArn
        search: Optional search term
        
    Returns:
        List of resources
    """
    if service not in COLLECTORS:
        raise ValueError(f"Unsupported service: {service}")
    
    collector_class = COLLECTORS[service]
    collector = collector_class()
    
    all_resources = []
    
    # If no accounts specified, use current account
    if not accounts:
        # Get current account ID
        try:
            sts = boto3.client('sts', region_name='us-east-1')
            current_account = sts.get_caller_identity()
            current_account_id = current_account['Account']
            accounts = [{'accountId': current_account_id, 'roleArn': None}]
            print(f"Using current account: {current_account_id}")
        except Exception as e:
            print(f"Failed to get current account ID: {str(e)}")
            accounts = [{'accountId': None, 'roleArn': None}]
    
    # Collect from each account
    for account in accounts:
        account_id = account.get('accountId')
        role_arn = account.get('roleArn')
        
        try:
            # Get clients for all regions
            clients = client_manager.get_clients_for_regions(
                service,
                regions,
                account_id,
                role_arn
            )
            
            if not clients:
                print(f"Warning: No clients created for account {account_id}, service {service}")
                continue
            
            # Collect resources from all regions
            resources = collector.collect_multi_region(clients, regions, account_id)
        except Exception as e:
            print(f"Error collecting from account {account_id}: {str(e)}")
            # Continue with other accounts even if one fails
            continue
        
        # Ensure account_id and region are present in all resources
        for resource in resources:
            # Always add region if not present
            if 'region' not in resource:
                # Try to get from first available region in the list
                resource['region'] = regions[0] if regions else 'unknown'
            
            # Always add account_id if not present
            if 'accountId' not in resource:
                if account_id:
                    resource['accountId'] = account_id
                else:
                    # Fallback: try to get current account
                    try:
                        sts = boto3.client('sts', region_name='us-east-1')
                        current_account = sts.get_caller_identity()
                        resource['accountId'] = current_account['Account']
                    except Exception:
                        resource['accountId'] = 'unknown'
        
        all_resources.extend(resources)
    
    # Filter by search term if provided
    if search:
        all_resources = collector.filter_resources(all_resources, search)
    
    return all_resources


def validate_service(service: str) -> bool:
    """Validate service name"""
    if not service or not isinstance(service, str):
        return False
    return service.lower() in COLLECTORS


def validate_pagination(page: Any, size: Any) -> tuple[int, int]:
    """Validate and normalize pagination parameters"""
    try:
        page_num = max(1, int(page)) if page else 1
        size_num = max(1, min(100, int(size))) if size else 50
        return page_num, size_num
    except (ValueError, TypeError):
        raise ValueError("Invalid pagination parameters")


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler with comprehensive error handling
    
    Enterprise-grade error handling:
    - Input validation
    - Proper error messages
    - Logging for debugging
    - Security considerations
    - Timeout handling
    """
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return cors_preflight()
    
    # Log request for debugging (sanitized)
    request_id = event.get("requestContext", {}).get("requestId", "unknown")
    path = event.get("path", "")
    method = event.get("httpMethod", "")
    print(f"[{request_id}] {method} {path}")
    
    try:
        # Extract user groups from Cognito claims
        try:
            claims = event["requestContext"]["authorizer"]["claims"]
            groups = extract_groups_from_claims(claims)
        except (KeyError, TypeError):
            groups = []

        # Parse query parameters
        params = event.get("queryStringParameters") or {}
        path = event.get("path", "")
        
        # Route based on path
        if path.endswith("/accounts"):
            # List available accounts
            try:
                accounts = client_manager.get_accounts_from_org()
                return success_response({"accounts": accounts})
            except Exception as e:
                return error_response("Failed to list accounts", 500, str(e))
        
        if path.endswith("/summary"):
            # Get summary statistics
            service = params.get("service", "").lower()
            if not validate_service(service):
                return error_response("Invalid service specified", 400, error_code="INVALID_SERVICE")
            if not can_access_service(groups, service):
                return error_response("Access denied", 403, error_code="ACCESS_DENIED")
            
            regions = get_regions_from_params(params, service)
            accounts = get_accounts_from_params(params)
            
            try:
                resources = collect_inventory(service, regions, accounts)
                
                # Calculate summary
                total = len(resources)
                running = sum(1 for r in resources if r.get('state', '').lower() in ['running', 'available', 'active'])
                stopped = sum(1 for r in resources if r.get('state', '').lower() in ['stopped', 'stopping'])
                errors = sum(1 for r in resources if r.get('status', '').lower() in ['error', 'failed'])
                
                # Security issues
                security_issues = 0
                if service == 's3':
                    security_issues = sum(1 for r in resources if r.get('public', False) or r.get('encryption') == 'None')
                elif service == 'rds':
                    security_issues = sum(1 for r in resources if not r.get('encrypted', False))
                
                return success_response({
                    "total": total,
                    "running": running,
                    "stopped": stopped,
                    "errors": errors,
                    "securityIssues": security_issues
                })
            except ValueError as e:
                return error_response("Invalid request parameters", 400, str(e), error_code="VALIDATION_ERROR")
            except Exception as e:
                print(f"[{request_id}] Error getting summary: {str(e)}")
                import traceback
                traceback.print_exc()
                return error_response("Failed to get summary", 500, str(e) if os.environ.get("ENVIRONMENT") != "prod" else None, error_code="INTERNAL_ERROR")
        
        if path.endswith("/export"):
            # Export functionality
            service = params.get("service", "").lower()
            if not validate_service(service):
                return error_response("Invalid service specified", 400, error_code="INVALID_SERVICE")
            if not can_access_service(groups, service):
                return error_response("Access denied", 403, error_code="ACCESS_DENIED")
            
            export_format = params.get("format", "json").lower()
            regions = get_regions_from_params(params, service)
            accounts = get_accounts_from_params(params)
            search = params.get("search", "")
            
            try:
                resources = collect_inventory(service, regions, accounts, search)
                
                if export_format == "csv":
                    # Generate CSV with flattened nested data
                    if not resources:
                        csv = "No data"
                    else:
                        import csv as csv_module
                        import io
                        from utils.response import CORS_HEADERS
                        
                        # Flatten nested dictionaries and arrays for CSV
                        def flatten_dict(d, parent_key='', sep='_'):
                            items = []
                            for k, v in d.items():
                                new_key = f"{parent_key}{sep}{k}" if parent_key else k
                                if isinstance(v, dict):
                                    items.extend(flatten_dict(v, new_key, sep=sep).items())
                                elif isinstance(v, list):
                                    # Convert list to comma-separated string
                                    items.append((new_key, ','.join(str(item) for item in v)))
                                else:
                                    items.append((new_key, v))
                            return dict(items)
                        
                        flattened_resources = [flatten_dict(r) for r in resources]
                        
                        # Get all unique keys
                        all_keys = set()
                        for r in flattened_resources:
                            all_keys.update(r.keys())
                        
                        # Prioritize region and accountId columns (put them first)
                        priority_keys = ['accountId', 'region']
                        other_keys = sorted([k for k in all_keys if k not in priority_keys])
                        fieldnames = [k for k in priority_keys if k in all_keys] + other_keys
                        
                        output = io.StringIO()
                        writer = csv_module.DictWriter(output, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(flattened_resources)
                        csv = output.getvalue()
                    
                    return {
                        "statusCode": 200,
                        "headers": {
                            **CORS_HEADERS,
                            "Content-Type": "text/csv",
                            "Content-Disposition": f'attachment; filename="{service}_inventory.csv"'
                        },
                        "body": csv
                    }
                else:
                    # JSON export
                    return success_response({
                        "service": service,
                        "total": len(resources),
                        "items": resources
                    })
            except ValueError as e:
                return error_response("Invalid request parameters", 400, str(e), error_code="VALIDATION_ERROR")
            except Exception as e:
                print(f"[{request_id}] Error exporting: {str(e)}")
                import traceback
                traceback.print_exc()
                return error_response("Export failed", 500, str(e) if os.environ.get("ENVIRONMENT") != "prod" else None, error_code="EXPORT_ERROR")
        
        if path.endswith("/details"):
            # Resource detail endpoint
            service = params.get("service", "").lower()
            resource_id = params.get("resourceId", "")
            
            if not service or not resource_id:
                return error_response("Missing service or resourceId parameter", 400)
            
            if not can_access_service(groups, service):
                return error_response("Access denied", 403)
            
            try:
                regions = get_regions_from_params(params, service)
                accounts = get_accounts_from_params(params)
                
                # Collect inventory and find the specific resource
                resources = collect_inventory(service, regions, accounts)
                
                # Find resource by ID (check various ID fields)
                resource = None
                for r in resources:
                    if (r.get('id') == resource_id or 
                        r.get('instance_id') == resource_id or
                        r.get('bucket_name') == resource_id or
                        r.get('table_name') == resource_id or
                        r.get('role_name') == resource_id or
                        r.get('vpc_id') == resource_id or
                        r.get('cluster_name') == resource_id or
                        r.get('db_identifier') == resource_id):
                        resource = r
                        break
                
                if not resource:
                    return error_response("Resource not found", 404)
                
                return success_response(resource)
            except Exception as e:
                return error_response("Failed to get resource details", 500, str(e))
        
        # Default: inventory endpoint
        service = params.get("service", "ec2").lower()
        
        # Validate service
        if not validate_service(service):
            return error_response("Invalid service specified", 400, error_code="INVALID_SERVICE")
        
        # Check authorization
        if not can_access_service(groups, service):
            return error_response("Access denied", 403, error_code="ACCESS_DENIED")
        
        # Parse and validate parameters
        try:
            page, size = validate_pagination(params.get("page"), params.get("size"))
        except ValueError as e:
            return error_response("Invalid pagination parameters", 400, str(e), error_code="VALIDATION_ERROR")
        
        # Sanitize search input
        search = params.get("search", "").strip()[:500]  # Limit search length
        
        # Get regions and accounts
        try:
            regions = get_regions_from_params(params, service)
            accounts = get_accounts_from_params(params)
        except Exception as e:
            return error_response("Invalid region or account parameters", 400, str(e), error_code="VALIDATION_ERROR")
        
        # Collect inventory
        try:
            resources = collect_inventory(service, regions, accounts, search)
            
            # Paginate
            total = len(resources)
            start = (page - 1) * size
            paginated_resources = resources[start:start + size]
            
            return success_response({
                "service": service,
                "total": total,
                "page": page,
                "size": size,
                "items": paginated_resources,
                "regions": regions,
                "accounts": [acc.get('accountId') for acc in accounts] if accounts else None
            })
        except ValueError as e:
            return error_response("Invalid service or parameters", 400, str(e), error_code="VALIDATION_ERROR")
        except Exception as e:
            print(f"[{request_id}] ERROR collecting {service} inventory: {str(e)}")
            import traceback
            traceback.print_exc()
            error_details = str(e) if os.environ.get("ENVIRONMENT") != "prod" else None
            return error_response(f"Failed to collect {service} inventory", 500, error_details, error_code="COLLECTION_ERROR")
    except ValueError as e:
        return error_response("Invalid request", 400, str(e), error_code="VALIDATION_ERROR")
    except Exception as e:
        print(f"[{request_id}] ERROR in lambda_handler: {str(e)}")
        import traceback
        traceback.print_exc()
        error_details = str(e) if os.environ.get("ENVIRONMENT") != "prod" else None
        return error_response("Internal server error", 500, error_details, error_code="INTERNAL_ERROR")
