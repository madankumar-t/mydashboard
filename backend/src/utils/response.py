"""
Response utilities for Lambda

Python 3.12+ compatible, forward-compatible with Python 3.14+
"""

from __future__ import annotations  # PEP 563 - Deferred evaluation of annotations

import json
from typing import Dict, Any, Optional


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
    "Access-Control-Allow-Credentials": "true"
}


def success_response(
    data: Any,
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """Create success response"""
    response_headers = {**CORS_HEADERS}
    if headers:
        response_headers.update(headers)
    
    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(data, default=str)
    }


def error_response(
    message: str,
    status_code: int = 400,
    details: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
    error_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create error response with comprehensive error information
    
    Args:
        message: User-friendly error message
        status_code: HTTP status code
        details: Additional error details (for debugging)
        headers: Additional headers
        error_code: Machine-readable error code
    """
    response_headers = {**CORS_HEADERS}
    if headers:
        response_headers.update(headers)
    
    body: Dict[str, Any] = {
        "error": message,
        "statusCode": status_code
    }
    
    if error_code:
        body["code"] = error_code
    
    if details:
        body["details"] = details
    
    # Only include details in development/staging
    import os
    if os.environ.get("ENVIRONMENT") not in ["prod", "production"]:
        body["debug"] = details
    
    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(body)
    }


def cors_preflight() -> Dict[str, Any]:
    """Handle CORS preflight request"""
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": ""
    }

