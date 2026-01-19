"""
EC2 Instance Collector

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Dict, Any, Optional
from .base import BaseCollector


class EC2Collector(BaseCollector):
    """Collects EC2 instances"""
    
    def __init__(self):
        super().__init__('ec2')
    
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Collect EC2 instances from a region"""
        items = []
        
        try:
            paginator = client.get_paginator('describe_instances')
            
            for page in paginator.paginate():
                for reservation in page['Reservations']:
                    for instance in reservation['Instances']:
                        tags = {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}
                        
                        items.append({
                            'id': instance['InstanceId'],
                            'instance_id': instance['InstanceId'],
                            'name': tags.get('Name', ''),
                            'state': instance['State']['Name'],
                            'instance_type': instance['InstanceType'],
                            'private_ip': instance.get('PrivateIpAddress'),
                            'public_ip': instance.get('PublicIpAddress'),
                            'security_groups': [
                                sg['GroupName'] for sg in instance.get('SecurityGroups', [])
                            ],
                            'vpc_id': instance.get('VpcId'),
                            'subnet_id': instance.get('SubnetId'),
                            'launch_time': instance.get('LaunchTime').isoformat() if instance.get('LaunchTime') else None,
                            'tags': tags,
                            'region': region
                        })
        except Exception as e:
            print(f"Error collecting EC2 instances from {region}: {str(e)}")
        
        return items

