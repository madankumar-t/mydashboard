"""
Authorization utilities
Handles role-based access control based on Cognito groups

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

from typing import List, Optional


def extract_groups_from_claims(claims: dict) -> List[str]:
    """
    Extract groups from Cognito JWT claims

    Supports:
    - cognito:groups (Cognito groups)
    - custom:groups (Custom attribute)
    - IdP group claims (e.g., from SAML)
    """
    groups = []

    # Cognito groups
    cognito_groups = claims.get('cognito:groups', '')
    if cognito_groups:
        if isinstance(cognito_groups, str):
            groups.extend([g.strip()
                          for g in cognito_groups.split(',') if g.strip()])
        elif isinstance(cognito_groups, list):
            groups.extend(cognito_groups)

    # Custom groups attribute
    custom_groups = claims.get('custom:groups', '')
    if custom_groups:
        if isinstance(custom_groups, str):
            groups.extend([g.strip()
                          for g in custom_groups.split(',') if g.strip()])
        elif isinstance(custom_groups, list):
            groups.extend(custom_groups)

    # IdP group claims (common SAML attribute names)
    idp_group_attrs = [
        'groups',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
    ]

    for attr in idp_group_attrs:
        idp_groups = claims.get(attr, '')
        if idp_groups:
            if isinstance(idp_groups, str):
                groups.extend([g.strip()
                              for g in idp_groups.split(',') if g.strip()])
            elif isinstance(idp_groups, list):
                groups.extend(idp_groups)

    return list(set(groups))  # Remove duplicates


def can_access_service(groups: List[str], service: str) -> bool:
    """
    Check if user can access a service based on groups

    Access rules:
    - admins / infra-admins: All services
    - read-only / cloud-readonly: EC2, S3 only
    - security: IAM, EC2, S3, RDS (security-focused)
    - SAML users: Full access (temporary - configure proper groups in Azure AD)
    """
    service_lower = service.lower()

    # Admin groups have full access
    if any(group in groups for group in ['admins', 'infra-admins', 'administrators']):
        return True

    # SAML authenticated users - grant full access temporarily
    # TODO: Configure proper group mappings in Azure AD SAML attributes
    if any('_SAML' in group for group in groups):
        return True

    # Read-only groups
    if any(group in groups for group in ['read-only', 'cloud-readonly']):
        return service_lower in ['ec2', 's3']

    # Security group
    if 'security' in groups:
        return service_lower in ['iam', 'ec2', 's3', 'rds', 'vpc']

    return False


def get_accessible_services(groups: List[str]) -> List[str]:
    """Get list of services user can access"""
    all_services = ['ec2', 's3', 'rds', 'dynamodb', 'iam', 'vpc', 'eks', 'ecs']
    return [s for s in all_services if can_access_service(groups, s)]
