"""
Utility functions for collectors
"""

def normalize_tags(tags_list):
    """Convert AWS tags list to dictionary"""
    if not tags_list:
        return {}
    return {tag['Key']: tag['Value'] for tag in tags_list}

