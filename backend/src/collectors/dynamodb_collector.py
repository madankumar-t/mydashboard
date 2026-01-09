"""
DynamoDB Table Collector

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Dict, Any, Optional
from .base import BaseCollector


class DynamoDBCollector(BaseCollector):
    """Collects DynamoDB tables"""
    
    def __init__(self):
        super().__init__('dynamodb')
    
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Collect DynamoDB tables from a region"""
        items = []
        
        try:
            paginator = client.get_paginator('list_tables')
            
            table_names = []
            for page in paginator.paginate():
                table_names.extend(page.get('TableNames', []))
            
            # Describe tables individually (DynamoDB doesn't support batch describe)
            for table_name in table_names:
                try:
                    table_response = client.describe_table(TableName=table_name)
                    table = table_response['Table']
                    
                    items.append({
                        'id': table['TableArn'],
                        'table_name': table['TableName'],
                        'name': table['TableName'],
                        'status': table['TableStatus'],
                        'billing_mode': table.get('BillingModeSummary', {}).get('BillingMode', 'PROVISIONED'),
                        'item_count': table.get('ItemCount', 0),
                        'created_at': table.get('CreationDateTime').isoformat() if table.get('CreationDateTime') else None,
                        'region': region
                    })
                except Exception as e:
                    print(f"Error describing DynamoDB table {table_name}: {str(e)}")
                    continue
        except Exception as e:
            print(f"Error collecting DynamoDB tables from {region}: {str(e)}")
        
        return items

