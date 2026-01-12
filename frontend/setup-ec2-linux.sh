#!/bin/bash
# Automated Setup Script for Linux EC2 Instance
# Usage: curl -fsSL https://raw.githubusercontent.com/your-repo/setup-ec2-linux.sh | bash
# Or: wget -qO- https://raw.githubusercontent.com/your-repo/setup-ec2-linux.sh | bash

set -e

echo "🚀 Starting EC2 Linux setup for AWS Inventory Dashboard..."

# Detect Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot detect Linux distribution"
    exit 1
fi

echo "📦 Detected OS: $OS"

# Install Node.js
echo "📥 Installing Node.js 18.x..."
if [[ "$OS" == "amzn" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "centos" ]]; then
    # Amazon Linux 2 or RHEL-based
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    if command -v dnf &> /dev/null; then
        sudo dnf install -y nodejs
    else
        sudo yum install -y nodejs
    fi
elif [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    # Ubuntu/Debian
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "❌ Unsupported Linux distribution: $OS"
    exit 1
fi

# Install nginx
echo "📥 Installing nginx..."
if [[ "$OS" == "amzn" ]]; then
    sudo amazon-linux-extras install nginx1 -y
elif [[ "$OS" == "rhel" ]] || [[ "$OS" == "centos" ]]; then
    if command -v dnf &> /dev/null; then
        sudo dnf install -y nginx
    else
        sudo yum install -y nginx
    fi
elif [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo apt update
    sudo apt install -y nginx
fi

# Install Git
echo "📥 Installing Git..."
if [[ "$OS" == "amzn" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "centos" ]]; then
    if command -v dnf &> /dev/null; then
        sudo dnf install -y git
    else
        sudo yum install -y git
    fi
elif [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo apt install -y git
fi

# Verify installations
echo "✅ Verifying installations..."
node --version
npm --version
nginx -v
git --version

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/inventory-dashboard
sudo chown $USER:$USER /var/www/inventory-dashboard

# Create nginx configuration
echo "⚙️ Configuring nginx..."

if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    NGINX_CONFIG="/etc/nginx/sites-available/inventory-dashboard"
else
    NGINX_CONFIG="/etc/nginx/conf.d/inventory-dashboard.conf"
fi

sudo tee $NGINX_CONFIG > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    root /var/www/inventory-dashboard/frontend/out;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /_next/static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    error_page 404 /index.html;
}
EOF

# Enable site (Ubuntu/Debian only)
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo ln -sf /etc/nginx/sites-available/inventory-dashboard /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# Test and start nginx
echo "🔄 Starting nginx..."
sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx

# Create deployment script
echo "📝 Creating deployment script..."
sudo tee /var/www/inventory-dashboard/deploy.sh > /dev/null << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

cd /var/www/inventory-dashboard/frontend

echo "📦 Pulling latest changes..."
git pull origin main || echo "⚠️ Not a git repo, skipping pull"

echo "📥 Installing dependencies..."
npm install

echo "🔧 Loading environment variables..."
if [ -f .env.production ]; then
    source .env.production
else
    echo "⚠️ .env.production not found, using defaults"
    export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000/api}"
    export NEXT_PUBLIC_COGNITO_USER_POOL_ID="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-}"
    export NEXT_PUBLIC_COGNITO_CLIENT_ID="${NEXT_PUBLIC_COGNITO_CLIENT_ID:-}"
    export NEXT_PUBLIC_COGNITO_REGION="${NEXT_PUBLIC_COGNITO_REGION:-us-east-1}"
    export NEXT_PUBLIC_COGNITO_DOMAIN="${NEXT_PUBLIC_COGNITO_DOMAIN:-}"
fi
export NEXT_EXPORT=true

echo "🏗️ Building application..."
npm run build:static

echo "📁 Setting permissions..."
if [[ "$(id -u)" == "0" ]]; then
    # Running as root
    if [[ -f /etc/redhat-release ]]; then
        chown -R nginx:nginx out/
    else
        chown -R www-data:www-data out/
    fi
else
    # Running as regular user
    if [[ -f /etc/redhat-release ]]; then
        sudo chown -R nginx:nginx out/
    else
        sudo chown -R www-data:www-data out/
    fi
fi
chmod -R 755 out/

echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

echo "✅ Deployment complete!"
DEPLOY_SCRIPT

sudo chmod +x /var/www/inventory-dashboard/deploy.sh
sudo chown $USER:$USER /var/www/inventory-dashboard/deploy.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Upload your frontend code to: /var/www/inventory-dashboard/frontend"
echo "2. Create .env.production file with your configuration"
echo "3. Run: cd /var/www/inventory-dashboard/frontend && npm install"
echo "4. Run: source .env.production && export NEXT_EXPORT=true && npm run build:static"
echo "5. Set permissions: sudo chown -R nginx:nginx /var/www/inventory-dashboard/frontend/out"
echo "6. Test: curl http://localhost"
echo ""
echo "📝 To deploy updates, run: /var/www/inventory-dashboard/deploy.sh"

