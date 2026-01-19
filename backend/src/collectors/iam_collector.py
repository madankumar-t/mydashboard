"""
IAM Role Collector

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Dict, Any, Optional
from .base import BaseCollector


class IAMCollector(BaseCollector):
    """Collects IAM roles"""
    
    def __init__(self):
        super().__init__('iam')
    
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Collect IAM roles (IAM is global, but we include region for consistency)"""
        items = []
        
        try:
            paginator = client.get_paginator('list_roles')
            
            for page in paginator.paginate():
                for role in page['Roles']:
                    items.append({
                        'id': role['Arn'],
                        'role_name': role['RoleName'],
                        'name': role['RoleName'],
                        'arn': role['Arn'],
                        'created': role['CreateDate'].isoformat() if role.get('CreateDate') else None,
                        'assume_role_policy': role.get('AssumeRolePolicyDocument', {}),
                        'region': 'global'  # IAM is global
                    })
        except Exception as e:
            print(f"Error collecting IAM roles: {str(e)}")
        
        return items

