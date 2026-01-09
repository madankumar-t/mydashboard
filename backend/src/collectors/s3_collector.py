"""
S3 Bucket Collector

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Dict, Any, Optional
from .base import BaseCollector


class S3Collector(BaseCollector):
    """Collects S3 buckets"""
    
    def __init__(self):
        super().__init__('s3')
    
    def collect_single_region(
        self,
        client: Any,
        region: str,
        account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Collect S3 buckets"""
        items = []
        
        try:
            # S3 is global, but we need to check bucket locations
            buckets = client.list_buckets()['Buckets']
            
            for bucket_info in buckets:
                bucket_name = bucket_info['Name']
                
                try:
                    # Get bucket location
                    location_response = client.get_bucket_location(Bucket=bucket_name)
                    bucket_region = location_response.get('LocationConstraint') or 'us-east-1'
                    
                    # Only include if bucket is in the requested region
                    if bucket_region != region:
                        continue
                    
                    # Get additional bucket properties
                    versioning = 'Disabled'
                    try:
                        versioning_response = client.get_bucket_versioning(Bucket=bucket_name)
                        versioning = versioning_response.get('Status', 'Disabled')
                    except Exception:
                        pass
                    
                    encryption = 'None'
                    try:
                        enc_response = client.get_bucket_encryption(Bucket=bucket_name)
                        encryption = (
                            enc_response['ServerSideEncryptionConfiguration']['Rules'][0]
                            ['ApplyServerSideEncryptionByDefault']['SSEAlgorithm']
                        )
                    except Exception:
                        pass
                    
                    public = False
                    try:
                        policy_status = client.get_bucket_policy_status(Bucket=bucket_name)
                        public = policy_status['PolicyStatus']['IsPublic']
                    except Exception:
                        pass
                    
                    items.append({
                        'id': bucket_name,
                        'bucket_name': bucket_name,
                        'name': bucket_name,
                        'region': bucket_region,
                        'versioning': versioning,
                        'encryption': encryption,
                        'public': public,
                        'creation_date': bucket_info.get('CreationDate').isoformat() if bucket_info.get('CreationDate') else None
                    })
                except Exception as e:
                    print(f"Error processing S3 bucket {bucket_name}: {str(e)}")
                    continue
        except Exception as e:
            print(f"Error collecting S3 buckets: {str(e)}")
        
        return items

