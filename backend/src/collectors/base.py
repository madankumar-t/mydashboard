"""
Base collector class for AWS service inventory

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import json


class BaseCollector(ABC):
    """Base class for AWS service collectors"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
    
    @abstractmethod
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Collect resources from a single region
        
        Args:
            client: Boto3 client for the service
            region: AWS region
            account_id: Account ID (for multi-account)
            
        Returns:
            List of resource dictionaries
        """
        pass
    
    def collect_multi_region(
        self,
        clients: Dict[str, Any],
        regions: List[str],
        account_id: Optional[str] = None,
        max_workers: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Collect resources from multiple regions in parallel
        
        Args:
            clients: Dict mapping region -> client
            regions: List of regions to collect from
            account_id: Account ID (for multi-account)
            max_workers: Maximum parallel workers
            
        Returns:
            Combined list of resources from all regions
        """
        all_resources = []
        
        # If no clients available, return empty list
        if not clients:
            print(f"Warning: No clients available for {self.service_name}")
            return all_resources
        
        # For IAM (global service), only process one region
        if self.service_name == 'iam' and clients:
            # IAM is global, use the first available client
            region = list(clients.keys())[0]
            client = clients[region]
            try:
                resources = self.collect_single_region(client, 'global', account_id)
                # Ensure account_id is present
                for resource in resources:
                    if account_id:
                        resource['accountId'] = account_id
                    # IAM resources already have region='global' set
                all_resources.extend(resources)
            except Exception as e:
                print(f"Error collecting {self.service_name}: {str(e)}")
            return all_resources
        
        # For regional services, collect from all regions in parallel
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self.collect_single_region, clients[region], region, account_id): region
                for region in regions
                if region in clients
            }
            
            for future in as_completed(futures):
                region = futures[future]
                try:
                    resources = future.result()
                    # Ensure region and account_id are present in each resource
                    for resource in resources:
                        # Always set region (overwrite if already set)
                        resource['region'] = region
                        # Always set accountId if account_id is provided
                        if account_id:
                            resource['accountId'] = account_id
                    all_resources.extend(resources)
                except Exception as e:
                    print(f"Error collecting {self.service_name} from {region}: {str(e)}")
                    # Continue with other regions even if one fails
        
        return all_resources
    
    def filter_resources(
        self,
        resources: List[Dict[str, Any]],
        search_term: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Filter resources by search term
        
        Args:
            resources: List of resources
            search_term: Search term (searches in all fields)
            
        Returns:
            Filtered list of resources
        """
        if not search_term:
            return resources
        
        search_lower = search_term.lower()
        filtered = []
        
        for resource in resources:
            # Convert resource to JSON string for searching
            resource_str = json.dumps(resource, default=str).lower()
            if search_lower in resource_str:
                filtered.append(resource)
        
        return filtered
    
    def paginate_results(
        self,
        resources: List[Dict[str, Any]],
        page: int = 1,
        size: int = 50
    ) -> Dict[str, Any]:
        """
        Paginate results
        
        Args:
            resources: List of all resources
            page: Page number (1-indexed)
            size: Page size
            
        Returns:
            Dict with paginated results and metadata
        """
        total = len(resources)
        start = (page - 1) * size
        end = start + size
        
        return {
            'items': resources[start:end],
            'total': total,
            'page': page,
            'size': size,
            'total_pages': (total + size - 1) // size
        }

