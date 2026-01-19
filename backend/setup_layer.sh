#!/bin/bash
# Setup script for Lambda layer dependencies
# Supports Python 3.12 (latest stable) and forward-compatible

set -e

PYTHON_VERSION=${PYTHON_VERSION:-3.12}

echo "Setting up Lambda layer dependencies for Python ${PYTHON_VERSION}..."

# Create layer directory structure
mkdir -p layer/python/lib/python${PYTHON_VERSION}/site-packages

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt -t layer/python/lib/python${PYTHON_VERSION}/site-packages/

echo "Layer setup complete!"
echo "You can now run 'sam build' to build the application."
echo ""
echo "Note: To use a different Python version, set PYTHON_VERSION environment variable:"
echo "  PYTHON_VERSION=3.11 ./setup_layer.sh"

