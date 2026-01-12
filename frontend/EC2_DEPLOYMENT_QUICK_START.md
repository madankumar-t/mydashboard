# EC2 Deployment - Quick Start

## Prerequisites Checklist

- [ ] EC2 instance running (Ubuntu 22.04 or Amazon Linux 2)
- [ ] Security group allows HTTP (80), HTTPS (443), SSH (22)
- [ ] SSH access to instance
- [ ] Domain name pointing to EC2 (optional)

## Quick Deployment (5 Minutes)

### 1. Connect to EC2

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

### 2. Run Setup Script

```bash
# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/setup-ec2.sh | bash
```

### 3. Manual Setup (If Script Not Available)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# Create app directory
sudo mkdir -p /var/www/inventory-dashboard
sudo chown $USER:$USER /var/www/inventory-dashboard
cd /var/www/inventory-dashboard

# Clone or upload your code
git clone YOUR_REPO_URL frontend
cd frontend

# Install and build
npm install
export NEXT_PUBLIC_API_URL="https://your-api.execute-api.region.amazonaws.com/prod"
export NEXT_PUBLIC_COGNITO_USER_POOL_ID="us-east-2_Cb4IW3we4"
export NEXT_PUBLIC_COGNITO_CLIENT_ID="776457erti67mcbdlffj8idon6"
export NEXT_PUBLIC_COGNITO_REGION="us-east-2"
export NEXT_PUBLIC_COGNITO_DOMAIN="your-domain-name"
export NEXT_EXPORT=true
npm run build:static

# Configure nginx
sudo nano /etc/nginx/sites-available/inventory-dashboard
# Paste nginx config from EC2_DEPLOYMENT_GUIDE.md

sudo ln -s /etc/nginx/sites-available/inventory-dashboard /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Set permissions
sudo chown -R www-data:www-data out/
```

### 4. Test

Visit: `http://YOUR_EC2_IP` or `http://your-domain.com`

## Common Commands

```bash
# Deploy updates
cd /var/www/inventory-dashboard && ./deploy.sh

# Check nginx status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

## Troubleshooting

**502 Bad Gateway**: Check nginx error logs, verify app is built
**404 Not Found**: Check nginx config, verify `try_files` directive
**Permission Denied**: Run `sudo chown -R www-data:www-data /var/www/inventory-dashboard`

See `EC2_DEPLOYMENT_GUIDE.md` for detailed instructions.

