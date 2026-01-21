"""
DynamoDB Storage Utilities
Handles storing and retrieving inventory data from DynamoDB

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

import boto3
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from decimal import Decimal


class DynamoDBStorage:
    """Manages inventory data storage in DynamoDB"""
    
    def __init__(self):
        self.table_name = os.environ.get('INVENTORY_TABLE_NAME', 'aws-inventory-data')
        self.metadata_table_name = os.environ.get('METADATA_TABLE_NAME', 'aws-inventory-metadata')
        self.dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        self.table = self.dynamodb.Table(self.table_name)
        self.metadata_table = self.dynamodb.Table(self.metadata_table_name)
    
    def _convert_to_dynamodb_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Python types to DynamoDB-compatible types"""
        def convert_value(value: Any) -> Any:
            if isinstance(value, dict):
                return {k: convert_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [convert_value(v) for v in value]
            elif isinstance(value, (int, float)):
                # DynamoDB doesn't support float, convert to Decimal
                return Decimal(str(value)) if isinstance(value, float) else value
            elif isinstance(value, bool):
                return value
            elif value is None:
                return None
            else:
                return str(value)
        
        return convert_value(item)
    
    def _convert_from_dynamodb_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Convert DynamoDB types back to Python types"""
        def convert_value(value: Any) -> Any:
            if isinstance(value, dict):
                return {k: convert_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [convert_value(v) for v in value]
            elif isinstance(value, Decimal):
                # Convert Decimal to float
                return float(value)
            else:
                return value
        
        return convert_value(item)
    
    def store_resources(
        self,
        service: str,
        account_id: str,
        region: str,
        resources: List[Dict[str, Any]],
        timestamp: Optional[datetime] = None
    ) -> None:
        """
        Store resources in DynamoDB
        
        Args:
            service: Service name (e.g., 'ec2', 's3')
            account_id: AWS account ID
            region: AWS region
            resources: List of resource dictionaries
            timestamp: Timestamp for this collection (defaults to now)
        """
        if timestamp is None:
            timestamp = datetime.now(timezone.utc)
        
        timestamp_str = timestamp.isoformat()
        
        # Delete existing items for this service/account/region combination
        self._delete_resources(service, account_id, region)
        
        # Batch write new items (DynamoDB batch write limit is 25 items)
        batch_size = 25
        for i in range(0, len(resources), batch_size):
            batch = resources[i:i + batch_size]
            
            with self.table.batch_writer() as writer:
                for resource in batch:
                    # Create composite key: service#accountId#region#resourceId
                    resource_id = resource.get('id') or resource.get('instance_id') or resource.get('bucket_name') or \
                                 resource.get('table_name') or resource.get('role_name') or resource.get('vpc_id') or \
                                 resource.get('cluster_name') or resource.get('db_identifier') or 'unknown'
                    
                    item = {
                        'pk': f"{service}#{account_id}#{region}",
                        'sk': resource_id,
                        'service': service,
                        'accountId': account_id,
                        'region': region,
                        'resourceId': resource_id,
                        'data': self._convert_to_dynamodb_item(resource),
                        'updatedAt': timestamp_str,
                        'ttl': int((timestamp.timestamp() + (90 * 24 * 60 * 60)))  # 90 days TTL
                    }
                    
                    writer.put_item(Item=item)
        
        # Update metadata
        self._update_metadata(service, account_id, region, timestamp_str, len(resources))
    
    def _delete_resources(self, service: str, account_id: str, region: str) -> None:
        """Delete existing resources for a service/account/region combination"""
        pk = f"{service}#{account_id}#{region}"
        
        # Query all items with this partition key
        response = self.table.query(
            KeyConditionExpression='pk = :pk',
            ExpressionAttributeValues={':pk': pk},
            ProjectionExpression='pk, sk'
        )
        
        # Batch delete
        items_to_delete = response.get('Items', [])
        if items_to_delete:
            with self.table.batch_writer() as writer:
                for item in items_to_delete:
                    writer.delete_item(Key={'pk': item['pk'], 'sk': item['sk']})
            
            # Handle pagination if there are more items
            while 'LastEvaluatedKey' in response:
                response = self.table.query(
                    KeyConditionExpression='pk = :pk',
                    ExpressionAttributeValues={':pk': pk},
                    ProjectionExpression='pk, sk',
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                items_to_delete = response.get('Items', [])
                if items_to_delete:
                    with self.table.batch_writer() as writer:
                        for item in items_to_delete:
                            writer.delete_item(Key={'pk': item['pk'], 'sk': item['sk']})
    
    def get_resources(
        self,
        service: str,
        account_ids: Optional[List[str]] = None,
        regions: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve resources from DynamoDB
        
        Args:
            service: Service name
            account_ids: Optional list of account IDs to filter
            regions: Optional list of regions to filter
            
        Returns:
            List of resource dictionaries
        """
        all_resources = []
        
        # Get all accounts if not specified
        if account_ids is None:
            account_ids = self._get_all_accounts()
        
        # Get all regions if not specified
        if regions is None:
            regions = self._get_all_regions(service)
        
        # Query for each account/region combination
        for account_id in account_ids:
            for region in regions:
                pk = f"{service}#{account_id}#{region}"
                
                try:
                    response = self.table.query(
                        KeyConditionExpression='pk = :pk',
                        ExpressionAttributeValues={':pk': pk}
                    )
                    
                    for item in response.get('Items', []):
                        resource = self._convert_from_dynamodb_item(item.get('data', {}))
                        # Ensure accountId and region are set
                        resource['accountId'] = account_id
                        resource['region'] = region
                        all_resources.append(resource)
                    
                    # Handle pagination
                    while 'LastEvaluatedKey' in response:
                        response = self.table.query(
                            KeyConditionExpression='pk = :pk',
                            ExpressionAttributeValues={':pk': pk},
                            ExclusiveStartKey=response['LastEvaluatedKey']
                        )
                        for item in response.get('Items', []):
                            resource = self._convert_from_dynamodb_item(item.get('data', {}))
                            resource['accountId'] = account_id
                            resource['region'] = region
                            all_resources.append(resource)
                except Exception as e:
                    print(f"Error querying DynamoDB for {service}#{account_id}#{region}: {str(e)}")
                    continue
        
        return all_resources
    
    def _get_all_accounts(self) -> List[str]:
        """Get all unique account IDs from metadata"""
        try:
            response = self.metadata_table.scan(
                ProjectionExpression='accountId'
            )
            account_ids = set()
            for item in response.get('Items', []):
                account_ids.add(item['accountId'])
            
            # Handle pagination
            while 'LastEvaluatedKey' in response:
                response = self.metadata_table.scan(
                    ProjectionExpression='accountId',
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                for item in response.get('Items', []):
                    account_ids.add(item['accountId'])
            
            return list(account_ids)
        except Exception as e:
            print(f"Error getting accounts from metadata: {str(e)}")
            return []
    
    def _get_all_regions(self, service: str) -> List[str]:
        """Get all unique regions for a service from metadata"""
        try:
            response = self.metadata_table.query(
                KeyConditionExpression='service = :service',
                ExpressionAttributeValues={':service': service},
                ProjectionExpression='region'
            )
            regions = set()
            for item in response.get('Items', []):
                if 'region' in item:
                    regions.add(item['region'])
            
            # Handle pagination
            while 'LastEvaluatedKey' in response:
                response = self.metadata_table.query(
                    KeyConditionExpression='service = :service',
                    ExpressionAttributeValues={':service': service},
                    ProjectionExpression='region',
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                for item in response.get('Items', []):
                    if 'region' in item:
                        regions.add(item['region'])
            
            return list(regions) if regions else ['us-east-1']  # Default to us-east-1
        except Exception as e:
            print(f"Error getting regions from metadata: {str(e)}")
            return ['us-east-1']
    
    def _update_metadata(
        self,
        service: str,
        account_id: str,
        region: str,
        timestamp: str,
        resource_count: int
    ) -> None:
        """Update metadata table with last update information"""
        try:
            # Use composite sort key: accountId#region
            account_region = f"{account_id}#{region}"
            self.metadata_table.put_item(
                Item={
                    'service': service,
                    'accountRegion': account_region,
                    'accountId': account_id,
                    'region': region,
                    'updatedAt': timestamp,
                    'resourceCount': resource_count
                }
            )
        except Exception as e:
            print(f"Error updating metadata: {str(e)}")
    
    def get_last_update_time(self, service: Optional[str] = None) -> Optional[datetime]:
        """
        Get the last update time for a service (or overall if service is None)
        
        Args:
            service: Optional service name to filter
            
        Returns:
            Last update datetime or None
        """
        try:
            if service:
                response = self.metadata_table.query(
                    KeyConditionExpression='service = :service',
                    ExpressionAttributeValues={':service': service},
                    ProjectionExpression='updatedAt'
                )
            else:
                response = self.metadata_table.scan(
                    ProjectionExpression='updatedAt'
                )
            
            latest_timestamp = None
            for item in response.get('Items', []):
                updated_at = item.get('updatedAt')
                if updated_at:
                    try:
                        timestamp = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                        if latest_timestamp is None or timestamp > latest_timestamp:
                            latest_timestamp = timestamp
                    except Exception:
                        continue
            
            # Handle pagination
            while 'LastEvaluatedKey' in response:
                if service:
                    response = self.metadata_table.query(
                        KeyConditionExpression='service = :service',
                        ExpressionAttributeValues={':service': service},
                        ProjectionExpression='updatedAt',
                        ExclusiveStartKey=response['LastEvaluatedKey']
                    )
                else:
                    response = self.metadata_table.scan(
                        ProjectionExpression='updatedAt',
                        ExclusiveStartKey=response['LastEvaluatedKey']
                    )
                
                for item in response.get('Items', []):
                    updated_at = item.get('updatedAt')
                    if updated_at:
                        try:
                            timestamp = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                            if latest_timestamp is None or timestamp > latest_timestamp:
                                latest_timestamp = timestamp
                        except Exception:
                            continue
            
            return latest_timestamp
        except Exception as e:
            print(f"Error getting last update time: {str(e)}")
            return None


# Global instance
storage = DynamoDBStorage()

