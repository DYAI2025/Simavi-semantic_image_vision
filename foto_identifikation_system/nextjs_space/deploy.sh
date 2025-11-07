#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Fly.io Deployment Script ===${NC}"
echo ""

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo -e "${RED}Error: flyctl is not installed${NC}"
    echo "Please install flyctl first:"
    echo "  curl -L https://fly.io/install.sh | sh"
    echo ""
    echo "Or on macOS with Homebrew:"
    echo "  brew install flyctl"
    exit 1
fi

# Check if logged in
if ! flyctl auth whoami &> /dev/null; then
    echo -e "${YELLOW}You need to login to Fly.io first${NC}"
    flyctl auth login
fi

echo -e "${GREEN}Step 1: Checking if app exists...${NC}"
if flyctl apps list | grep -q "simavi-semantic-image-vision"; then
    echo -e "${GREEN}App exists, skipping creation${NC}"
else
    echo -e "${YELLOW}Creating new app...${NC}"
    flyctl apps create simavi-semantic-image-vision --org personal
fi

echo ""
echo -e "${GREEN}Step 2: Checking for PostgreSQL database...${NC}"
if flyctl postgres list | grep -q "simavi-db"; then
    echo -e "${GREEN}Database exists, skipping creation${NC}"
else
    echo -e "${YELLOW}Creating PostgreSQL database...${NC}"
    flyctl postgres create --name simavi-db --region fra --initial-cluster-size 1
    echo ""
    echo -e "${YELLOW}Attaching database to app...${NC}"
    flyctl postgres attach simavi-db --app simavi-semantic-image-vision
fi

echo ""
echo -e "${GREEN}Step 3: Configuring secrets...${NC}"

# Check if secrets are already set
if flyctl secrets list --app simavi-semantic-image-vision | grep -q "NEXTAUTH_SECRET"; then
    echo -e "${YELLOW}Some secrets already exist. Do you want to update them? (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        UPDATE_SECRETS=true
    else
        UPDATE_SECRETS=false
    fi
else
    UPDATE_SECRETS=true
fi

if [ "$UPDATE_SECRETS" = true ]; then
    echo -e "${YELLOW}Please provide the following values:${NC}"
    
    # Generate NEXTAUTH_SECRET if not provided
    echo "Generating NEXTAUTH_SECRET..."
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    # AWS Configuration
    read -p "AWS Bucket Name: " AWS_BUCKET_NAME
    read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
    read -s -p "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
    echo ""
    
    # Hugging Face API Key
    read -s -p "Hugging Face API Key: " HUGGINGFACE_API_KEY
    echo ""
    
    # Optional: OpenAI API Key
    read -s -p "OpenAI API Key (optional, press Enter to skip): " OPENAI_API_KEY
    echo ""
    
    # App Password
    read -s -p "App Password for authentication: " APP_PASSWORD
    echo ""
    
    echo ""
    echo -e "${GREEN}Setting secrets...${NC}"
    
    flyctl secrets set \
        NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
        NEXTAUTH_URL="https://simavi-semantic-image-vision.fly.dev" \
        AWS_BUCKET_NAME="$AWS_BUCKET_NAME" \
        AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
        AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
        HUGGINGFACE_API_KEY="$HUGGINGFACE_API_KEY" \
        APP_PASSWORD="$APP_PASSWORD" \
        --app simavi-semantic-image-vision
    
    if [ -n "$OPENAI_API_KEY" ]; then
        flyctl secrets set OPENAI_API_KEY="$OPENAI_API_KEY" --app simavi-semantic-image-vision
    fi
    
    echo -e "${GREEN}Secrets configured successfully!${NC}"
else
    echo -e "${YELLOW}Skipping secrets configuration${NC}"
fi

echo ""
echo -e "${GREEN}Step 4: Deploying application...${NC}"
flyctl deploy --app simavi-semantic-image-vision

echo ""
echo -e "${GREEN}Step 5: Checking deployment status...${NC}"
flyctl status --app simavi-semantic-image-vision

echo ""
echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo ""
echo "Your app is available at: https://simavi-semantic-image-vision.fly.dev"
echo ""
echo "Useful commands:"
echo "  flyctl logs --app simavi-semantic-image-vision          # View logs"
echo "  flyctl ssh console --app simavi-semantic-image-vision  # SSH into container"
echo "  flyctl status --app simavi-semantic-image-vision       # Check status"
echo ""
echo "Health check: https://simavi-semantic-image-vision.fly.dev/api/health"
