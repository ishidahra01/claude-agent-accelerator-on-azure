#!/bin/bash
set -e

# Azure Container Apps Deployment Script
# Prerequisites:
# - Azure CLI installed and authenticated (az login)
# - Azure subscription with appropriate permissions
# - Azure Container Registry created
# - Microsoft Foundry project with Claude model deployed

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-claude-agent-rg}"
LOCATION="${LOCATION:-eastus2}"
ACR_NAME="${ACR_NAME:-claudeagenacr}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-azure-resource-analyzer}"
CONTAINER_APP_ENV="${CONTAINER_APP_ENV:-claude-agent-env}"
IMAGE_NAME="azure-resource-analyzer"
IMAGE_TAG="${IMAGE_TAG:-latest}"
FOUNDRY_API_KEY_VALUE="${ANTHROPIC_FOUNDRY_API_KEY:-${FOUNDRY_API_KEY:-}}"
FOUNDRY_RESOURCE_VALUE="${ANTHROPIC_FOUNDRY_RESOURCE:-}"
FOUNDRY_BASE_URL_VALUE="${ANTHROPIC_FOUNDRY_BASE_URL:-${FOUNDRY_BASE_URL:-}}"
SONNET_MODEL_VALUE="${ANTHROPIC_DEFAULT_SONNET_MODEL:-${FOUNDRY_MODEL:-claude-sonnet-4-6}}"

echo "==================================================="
echo "Azure Container Apps Deployment"
echo "==================================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Container Registry: $ACR_NAME"
echo "Container App: $CONTAINER_APP_NAME"
echo "==================================================="

if [ -z "$FOUNDRY_RESOURCE_VALUE" ] && [ -z "$FOUNDRY_BASE_URL_VALUE" ]; then
  echo "Error: Set ANTHROPIC_FOUNDRY_RESOURCE or ANTHROPIC_FOUNDRY_BASE_URL before deploying."
  exit 1
fi

# Check if logged in to Azure
echo "Checking Azure CLI authentication..."
az account show > /dev/null 2>&1 || {
  echo "Error: Not logged in to Azure CLI. Run 'az login' first."
  exit 1
}

# Create resource group
echo "Creating resource group..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION"

# Create Azure Container Registry
echo "Creating Azure Container Registry..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true

# Build and push container image
echo "Building container image..."
az acr build \
  --registry "$ACR_NAME" \
  --image "$IMAGE_NAME:$IMAGE_TAG" \
  --file Dockerfile \
  .

# Get ACR credentials
echo "Retrieving ACR credentials..."
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" --output tsv)

# Create Container Apps Environment
echo "Creating Container Apps Environment..."
az containerapp env create \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"

# Deploy Container App
echo "Deploying Container App..."
az containerapp create \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_APP_ENV" \
  --image "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG" \
  --target-port 3000 \
  --ingress external \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --cpu 0.5 \
  --memory 1.0Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  $( [ -n "$FOUNDRY_API_KEY_VALUE" ] && printf '%s' "--secrets foundry-api-key=${FOUNDRY_API_KEY_VALUE}" ) \
  --env-vars \
    CLAUDE_CODE_USE_FOUNDRY=1 \
    $( [ -n "$FOUNDRY_API_KEY_VALUE" ] && printf '%s' "ANTHROPIC_FOUNDRY_API_KEY=secretref:foundry-api-key" ) \
    $( [ -n "$FOUNDRY_RESOURCE_VALUE" ] && printf '%s' "ANTHROPIC_FOUNDRY_RESOURCE=${FOUNDRY_RESOURCE_VALUE}" ) \
    $( [ -n "$FOUNDRY_BASE_URL_VALUE" ] && printf '%s' "ANTHROPIC_FOUNDRY_BASE_URL=${FOUNDRY_BASE_URL_VALUE}" ) \
    ANTHROPIC_DEFAULT_SONNET_MODEL="${SONNET_MODEL_VALUE}" \
    ANTHROPIC_DEFAULT_OPUS_MODEL="${ANTHROPIC_DEFAULT_OPUS_MODEL:-claude-opus-4-6}" \
    ANTHROPIC_DEFAULT_HAIKU_MODEL="${ANTHROPIC_DEFAULT_HAIKU_MODEL:-claude-haiku-4-5}" \
    NODE_ENV=production \
    ENABLE_TRACING="${ENABLE_TRACING:-false}" \
    ENABLE_EVALUATION="${ENABLE_EVALUATION:-false}"

# Get Container App URL
FQDN=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "==================================================="
echo "Deployment Complete!"
echo "==================================================="
echo "Container App URL: https://$FQDN"
echo "==================================================="
echo ""
echo "To update the app:"
echo "  az containerapp update \\"
echo "    --name $CONTAINER_APP_NAME \\"
echo "    --resource-group $RESOURCE_GROUP \\"
echo "    --image $ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG"
echo ""
echo "To view logs:"
echo "  az containerapp logs show \\"
echo "    --name $CONTAINER_APP_NAME \\"
echo "    --resource-group $RESOURCE_GROUP \\"
echo "    --follow"
