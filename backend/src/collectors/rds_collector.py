"""
RDS Instance Collector

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Dict, Any, Optional
from .base import BaseCollector


class RDSCollector(BaseCollector):
    """Collects RDS instances"""
    
    def __init__(self):
        super().__init__('rds')
    
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Collect RDS instances from a region"""
        items = []
        
        try:
            paginator = client.get_paginator('describe_db_instances')
            
            for page in paginator.paginate():
                for db in page['DBInstances']:
                    items.append({
                        'id': db['DBInstanceIdentifier'],
                        'db_identifier': db['DBInstanceIdentifier'],
                        'name': db.get('DBInstanceIdentifier', ''),
                        'engine': db['Engine'],
                        'engine_version': db['EngineVersion'],
                        'status': db['DBInstanceStatus'],
                        'instance_class': db['DBInstanceClass'],
                        'endpoint': db.get('Endpoint', {}).get('Address') if db.get('Endpoint') else None,
                        'encrypted': db.get('StorageEncrypted', False),
                        'multi_az': db.get('MultiAZ', False),
                        'created_at': db.get('InstanceCreateTime').isoformat() if db.get('InstanceCreateTime') else None,
                        'region': region
                    })
        except Exception as e:
            print(f"Error collecting RDS instances from {region}: {str(e)}")
        
        return items

