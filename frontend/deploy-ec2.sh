#!/bin/bash
# EC2 Deployment Script for AWS Inventory Dashboard Frontend
# Usage: ./deploy-ec2.sh [EC2_IP] [SSH_KEY]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EC2_IP="${1:-}"
SSH_KEY="${2:-}"
REMOTE_USER="${3:-ubuntu}"  # Use 'ec2-user' for Amazon Linux
REMOTE_PATH="/var/www/inventory-dashboard/frontend"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}Warning: .env.production not found. Creating from template...${NC}"
    cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://your-api.execute-api.region.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-2_Cb4IW3we4
NEXT_PUBLIC_COGNITO_CLIENT_ID=776457erti67mcbdlffj8idon6
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_DOMAIN=your-cognito-domain-name
NEXT_PUBLIC_SAML_PROVIDER_NAME=DCLI-SAML-POC
NEXT_EXPORT=true
EOF
    echo -e "${YELLOW}Please edit .env.production with your actual values${NC}"
    exit 1
fi

# Check if EC2_IP is provided
if [ -z "$EC2_IP" ]; then
    echo -e "${RED}Error: EC2 IP address required${NC}"
    echo "Usage: ./deploy-ec2.sh <EC2_IP> [SSH_KEY] [USER]"
    echo "Example: ./deploy-ec2.sh 54.123.45.67 ~/.ssh/my-key.pem ubuntu"
    exit 1
fi

# Check if SSH key is provided
if [ -z "$SSH_KEY" ]; then
    echo -e "${YELLOW}Warning: SSH key not provided. Using default key...${NC}"
    SSH_KEY="$HOME/.ssh/id_rsa"
fi

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}Error: SSH key not found: $SSH_KEY${NC}"
    exit 1
fi

echo -e "${GREEN}Starting deployment to EC2...${NC}"
echo -e "EC2 IP: ${YELLOW}$EC2_IP${NC}"
echo -e "SSH Key: ${YELLOW}$SSH_KEY${NC}"
echo -e "Remote User: ${YELLOW}$REMOTE_USER${NC}"

# Step 1: Build locally
echo -e "\n${YELLOW}Step 1: Building application locally...${NC}"
source .env.production
export NEXT_EXPORT=true
npm run build:static

if [ ! -d "out" ]; then
    echo -e "${RED}Error: Build failed. 'out' directory not found.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# Step 2: Create deployment package
echo -e "\n${YELLOW}Step 2: Creating deployment package...${NC}"
DEPLOY_DIR="deploy-temp"
rm -rf $DEPLOY_DIR
mkdir $DEPLOY_DIR

# Copy build output
cp -r out $DEPLOY_DIR/
# Copy environment file
cp .env.production $DEPLOY_DIR/

# Create remote deployment script
cat > $DEPLOY_DIR/deploy-remote.sh << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

cd /var/www/inventory-dashboard/frontend

echo "📦 Extracting deployment package..."
tar -xzf deploy-package.tar.gz

echo "📁 Setting permissions..."
sudo chown -R www-data:www-data out/
sudo chmod -R 755 out/

echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

echo "✅ Deployment complete!"
REMOTE_SCRIPT

chmod +x $DEPLOY_DIR/deploy-remote.sh

# Create tarball
echo -e "${YELLOW}Creating tarball...${NC}"
cd $DEPLOY_DIR
tar -czf deploy-package.tar.gz out/ .env.production deploy-remote.sh
cd ..

# Step 3: Upload to EC2
echo -e "\n${YELLOW}Step 3: Uploading to EC2...${NC}"
scp -i "$SSH_KEY" $DEPLOY_DIR/deploy-package.tar.gz $REMOTE_USER@$EC2_IP:/tmp/

# Step 4: Deploy on EC2
echo -e "\n${YELLOW}Step 4: Deploying on EC2...${NC}"
ssh -i "$SSH_KEY" $REMOTE_USER@$EC2_IP << EOF
set -e

# Create directory if it doesn't exist
sudo mkdir -p /var/www/inventory-dashboard/frontend
sudo chown $REMOTE_USER:$REMOTE_USER /var/www/inventory-dashboard/frontend

# Move package to deployment directory
cd /var/www/inventory-dashboard/frontend
mv /tmp/deploy-package.tar.gz .

# Extract and deploy
tar -xzf deploy-package.tar.gz
chmod +x deploy-remote.sh
./deploy-remote.sh

# Cleanup
rm deploy-package.tar.gz deploy-remote.sh

echo "✅ Deployment successful!"
EOF

# Cleanup local temp directory
rm -rf $DEPLOY_DIR

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo -e "Visit: ${YELLOW}http://$EC2_IP${NC} or ${YELLOW}https://your-domain.com${NC}"

