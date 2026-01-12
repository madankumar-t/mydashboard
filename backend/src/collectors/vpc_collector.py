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
            # Get VPCs - use paginator for consistency with other collectors
            paginator = client.get_paginator('describe_vpcs')
            
            for page in paginator.paginate():
                for vpc in page.get('Vpcs', []):
                    try:
                        tags = {tag['Key']: tag['Value'] for tag in vpc.get('Tags', [])}
                        
                        # Get subnets for this VPC (handle errors per VPC)
                        subnet_ids = []
                        try:
                            subnets_paginator = client.get_paginator('describe_subnets')
                            for subnets_page in subnets_paginator.paginate(
                                Filters=[{'Name': 'vpc-id', 'Values': [vpc['VpcId']]}]
                            ):
                                subnet_ids.extend([s['SubnetId'] for s in subnets_page.get('Subnets', [])])
                        except Exception as subnet_error:
                            # Log but don't fail the entire VPC collection
                            print(f"Warning: Failed to get subnets for VPC {vpc['VpcId']} in {region}: {str(subnet_error)}")
                        
                        # Handle state - it might be a dict with 'State' key or a string
                        state = vpc.get('State')
                        if isinstance(state, dict):
                            state = state.get('State', 'unknown')
                        elif isinstance(state, str):
                            state = state
                        else:
                            state = 'unknown'
                        
                        # Get IPv4 CIDR blocks (can be multiple)
                        cidr_blocks = [vpc.get('CidrBlock', '')]
                        if 'CidrBlockAssociationSet' in vpc:
                            for assoc in vpc['CidrBlockAssociationSet']:
                                if assoc.get('CidrBlock') and assoc.get('CidrBlock') not in cidr_blocks:
                                    cidr_blocks.append(assoc['CidrBlock'])
                        
                        items.append({
                            'id': vpc['VpcId'],
                            'vpc_id': vpc['VpcId'],
                            'name': tags.get('Name', ''),
                            'cidr_block': vpc.get('CidrBlock', ''),
                            'cidr_blocks': cidr_blocks if len(cidr_blocks) > 1 else None,  # Only include if multiple
                            'state': state,
                            'is_default': vpc.get('IsDefault', False),
                            'dhcp_options_id': vpc.get('DhcpOptionsId'),
                            'subnets': subnet_ids,
                            'subnet_count': len(subnet_ids),
                            'tags': tags,
                            'region': region
                        })
                    except Exception as vpc_error:
                        # Log error for this specific VPC but continue with others
                        print(f"Error processing VPC {vpc.get('VpcId', 'unknown')} in {region}: {str(vpc_error)}")
                        continue
                        
        except Exception as e:
            print(f"Error collecting VPCs from {region}: {str(e)}")
            import traceback
            traceback.print_exc()
        
        return items

