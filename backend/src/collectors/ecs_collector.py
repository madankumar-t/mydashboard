"""
ECS Cluster Collector

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Dict, Any, Optional
from .base import BaseCollector


class ECSCollector(BaseCollector):
    """Collects ECS clusters"""
    
    def __init__(self):
        super().__init__('ecs')
    
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Collect ECS clusters from a region"""
        items = []
        
        try:
            paginator = client.get_paginator('list_clusters')
            
            for page in paginator.paginate():
                cluster_arns = page.get('clusterArns', [])
                
                if not cluster_arns:
                    continue
                
                # Describe clusters in batches
                for i in range(0, len(cluster_arns), 10):
                    batch = cluster_arns[i:i+10]
                    try:
                        clusters_response = client.describe_clusters(clusters=batch)
                        
                        for cluster in clusters_response['clusters']:
                            # Get services and tasks
                            services_response = client.list_services(cluster=cluster['clusterName'])
                            services = services_response.get('serviceArns', [])
                            
                            tasks_response = client.list_tasks(cluster=cluster['clusterName'], desiredStatus='RUNNING')
                            running_tasks = len(tasks_response.get('taskArns', []))
                            
                            items.append({
                                'id': cluster['clusterArn'],
                                'cluster_name': cluster['clusterName'],
                                'name': cluster['clusterName'],
                                'status': cluster['status'],
                                'active_services': len(services),
                                'running_tasks': running_tasks,
                                'registered_container_instances': cluster.get('registeredContainerInstancesCount', 0),
                                'created_at': cluster.get('createdAt').isoformat() if cluster.get('createdAt') else None,
                                'region': region
                            })
                    except Exception as e:
                        print(f"Error describing ECS clusters: {str(e)}")
                        continue
        except Exception as e:
            print(f"Error collecting ECS clusters from {region}: {str(e)}")
        
        return items

