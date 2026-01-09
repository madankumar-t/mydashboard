"""
VPC Collector

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Dict, Any, Optional
from .base import BaseCollector


class VPCCollector(BaseCollector):
    """Collects VPCs"""
    
    def __init__(self):
        super().__init__('vpc')
    
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Collect VPCs from a region"""
        items = []
        
        try:
            # Get VPCs
            vpcs_response = client.describe_vpcs()
            
            for vpc in vpcs_response['Vpcs']:
                tags = {tag['Key']: tag['Value'] for tag in vpc.get('Tags', [])}
                
                # Get subnets for this VPC
                subnets_response = client.describe_subnets(
                    Filters=[{'Name': 'vpc-id', 'Values': [vpc['VpcId']]}]
                )
                subnet_ids = [s['SubnetId'] for s in subnets_response['Subnets']]
                
                items.append({
                    'id': vpc['VpcId'],
                    'vpc_id': vpc['VpcId'],
                    'name': tags.get('Name', ''),
                    'cidr_block': vpc['CidrBlock'],
                    'state': vpc['State'],
                    'is_default': vpc['IsDefault'],
                    'subnets': subnet_ids,
                    'tags': tags,
                    'region': region
                })
        except Exception as e:
            print(f"Error collecting VPCs from {region}: {str(e)}")
        
        return items

