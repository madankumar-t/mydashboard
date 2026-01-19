"""
EKS Cluster Collector

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Dict, Any, Optional
from .base import BaseCollector


class EKSCollector(BaseCollector):
    """Collects EKS clusters"""
    
    def __init__(self):
        super().__init__('eks')
    
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Collect EKS clusters from a region"""
        items = []
        
        try:
            paginator = client.get_paginator('list_clusters')
            
            for page in paginator.paginate():
                cluster_names = page.get('clusters', [])
                
                for cluster_name in cluster_names:
                    try:
                        cluster_response = client.describe_cluster(name=cluster_name)
                        cluster = cluster_response['cluster']
                        
                        # Get node groups
                        node_groups_response = client.list_nodegroups(clusterName=cluster_name)
                        node_groups = node_groups_response.get('nodegroups', [])
                        
                        items.append({
                            'id': cluster['arn'],
                            'cluster_name': cluster['name'],
                            'name': cluster['name'],
                            'status': cluster['status'],
                            'version': cluster.get('version', ''),
                            'endpoint': cluster.get('endpoint', ''),
                            'node_groups': node_groups,
                            'created_at': cluster.get('createdAt').isoformat() if cluster.get('createdAt') else None,
                            'region': region
                        })
                    except Exception as e:
                        print(f"Error describing EKS cluster {cluster_name}: {str(e)}")
                        continue
        except Exception as e:
            print(f"Error collecting EKS clusters from {region}: {str(e)}")
        
        return items

