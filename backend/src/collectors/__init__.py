"""
AWS Service Collectors

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from .ec2_collector import EC2Collector
from .vpc_collector import VPCCollector
from .eks_collector import EKSCollector
from .ecs_collector import ECSCollector
from .s3_collector import S3Collector
from .rds_collector import RDSCollector
from .dynamodb_collector import DynamoDBCollector
from .iam_collector import IAMCollector

# Collector registry
COLLECTORS = {
    'ec2': EC2Collector,
    'vpc': VPCCollector,
    'eks': EKSCollector,
    'ecs': ECSCollector,
    's3': S3Collector,
    'rds': RDSCollector,
    'dynamodb': DynamoDBCollector,
    'iam': IAMCollector,
}

