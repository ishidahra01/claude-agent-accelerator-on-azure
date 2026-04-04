# Deployment Guide: Azure Container Apps

This guide provides detailed instructions for deploying the Azure Resource Analysis Agent to Azure Container Apps.

## Prerequisites

### Azure Resources

1. **Azure Subscription**:
   - Active subscription with billing enabled
   - Contributor or Owner role in target resource group

2. **Microsoft Foundry Setup**:
   - Access to Azure AI Foundry (preview)
   - Claude Sonnet 4.5 deployed in supported region (East US2 or Sweden Central)
   - Foundry API key or Microsoft Entra ID authentication configured
   - Note your Foundry endpoint: `https://<resource-name>.services.ai.azure.com/anthropic`

### Local Tools

1. **Azure CLI**: Version 2.50.0 or later
   ```bash
   az --version
   az login
   ```

2. **Docker**: For local container testing
   ```bash
   docker --version
   ```

3. **Node.js**: Version 18+ for local development
   ```bash
   node --version
   ```

---

## Deployment Options

### Option 1: Quick Deploy with Bash Script (Recommended)

#### Step 1: Configure Environment

Create a `.env.deploy` file:
```bash
# Azure Configuration
RESOURCE_GROUP=claude-agent-rg
LOCATION=eastus2
ACR_NAME=claudeagenacr001  # Must be globally unique
CONTAINER_APP_NAME=azure-resource-analyzer
CONTAINER_APP_ENV=claude-agent-env

# Foundry Configuration
FOUNDRY_API_KEY=your_foundry_api_key_here
FOUNDRY_BASE_URL=https://your-resource.services.ai.azure.com/anthropic
FOUNDRY_MODEL=claude-sonnet-4-5

# Optional: Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=
ENABLE_TRACING=false
ENABLE_EVALUATION=false
```

#### Step 2: Deploy

```bash
# Load environment variables
source .env.deploy

# Make script executable
chmod +x infrastructure/deploy-aca.sh

# Deploy
./infrastructure/deploy-aca.sh
```

**Expected Output**:
```
===================================================
Deployment Complete!
===================================================
Container App URL: https://azure-resource-analyzer.xxx.azurecontainerapps.io
===================================================
```

#### Step 3: Verify Deployment

```bash
# Check app status
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.runningStatus"

# View logs
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow
```

---

### Option 2: Deploy with Bicep

#### Step 1: Create Parameters File

Create `infrastructure/bicep/parameters.json`:
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": {
      "value": "eastus2"
    },
    "containerAppName": {
      "value": "azure-resource-analyzer"
    },
    "foundryApiKey": {
      "value": "your_api_key_here"
    },
    "foundryBaseUrl": {
      "value": "https://your-resource.services.ai.azure.com/anthropic"
    },
    "foundryModel": {
      "value": "claude-sonnet-4-5"
    },
    "enableTracing": {
      "value": false
    }
  }
}
```

#### Step 2: Build and Push Container Image

```bash
# Build image locally
docker build -t azure-resource-analyzer:latest .

# Create ACR
az acr create \
  --resource-group claude-agent-rg \
  --name claudeagenacr001 \
  --sku Basic

# Login to ACR
az acr login --name claudeagenacr001

# Tag and push
docker tag azure-resource-analyzer:latest \
  claudeagenacr001.azurecr.io/azure-resource-analyzer:latest

docker push claudeagenacr001.azurecr.io/azure-resource-analyzer:latest
```

#### Step 3: Deploy with Bicep

```bash
# Create resource group
az group create \
  --name claude-agent-rg \
  --location eastus2

# Deploy
az deployment group create \
  --resource-group claude-agent-rg \
  --template-file infrastructure/bicep/main.bicep \
  --parameters infrastructure/bicep/parameters.json
```

---

### Option 3: Azure Portal Deployment

#### Step 1: Create Container Registry

1. Navigate to Azure Portal → Create a resource
2. Search for "Container Registry"
3. Create with Basic SKU
4. Enable Admin user in Settings → Access keys

#### Step 2: Build and Push Image

```bash
# Use ACR build task (builds in Azure, no local Docker needed)
az acr build \
  --registry claudeagenacr001 \
  --image azure-resource-analyzer:latest \
  --file Dockerfile \
  .
```

#### Step 3: Create Container App via Portal

1. Azure Portal → Create a resource → Container App
2. **Basics**:
   - Resource group: claude-agent-rg
   - Container app name: azure-resource-analyzer
   - Region: East US 2

3. **Container**:
   - Image source: Azure Container Registry
   - Registry: claudeagenacr001.azurecr.io
   - Image: azure-resource-analyzer
   - Tag: latest

4. **Ingress**:
   - Enabled: Yes
   - Ingress traffic: Accepting traffic from anywhere
   - Target port: 3000

5. **Environment Variables** (add as secrets):
   - FOUNDRY_API_KEY (secret)
   - FOUNDRY_BASE_URL
   - FOUNDRY_MODEL

6. **Review + Create**

---

## Post-Deployment Configuration

### Enable Application Insights

1. **Create Application Insights**:
   ```bash
   az monitor app-insights component create \
     --app claude-agent-insights \
     --location eastus2 \
     --resource-group claude-agent-rg \
     --application-type web
   ```

2. **Get Connection String**:
   ```bash
   az monitor app-insights component show \
     --app claude-agent-insights \
     --resource-group claude-agent-rg \
     --query "connectionString" \
     --output tsv
   ```

3. **Update Container App**:
   ```bash
   az containerapp update \
     --name azure-resource-analyzer \
     --resource-group claude-agent-rg \
     --set-env-vars \
       APPLICATIONINSIGHTS_CONNECTION_STRING="<connection-string>" \
       ENABLE_TRACING=true \
       ENABLE_EVALUATION=true
   ```

### Configure Managed Identity (Remove API Keys)

1. **Enable Managed Identity**:
   ```bash
   az containerapp identity assign \
     --name azure-resource-analyzer \
     --resource-group claude-agent-rg \
     --system-assigned
   ```

2. **Grant Foundry Access** (requires Foundry support for Managed Identity - future feature)

3. **Update Code** to use DefaultAzureCredential:
   ```typescript
   // src/models/foundry-client.ts
   import { DefaultAzureCredential } from '@azure/identity';

   const credential = new DefaultAzureCredential();
   const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
   ```

### Set Up Secrets in Key Vault

1. **Create Key Vault**:
   ```bash
   az keyvault create \
     --name claude-agent-kv \
     --resource-group claude-agent-rg \
     --location eastus2
   ```

2. **Store API Key**:
   ```bash
   az keyvault secret set \
     --vault-name claude-agent-kv \
     --name foundry-api-key \
     --value "your_api_key"
   ```

3. **Reference in Container App**:
   ```bash
   az containerapp update \
     --name azure-resource-analyzer \
     --resource-group claude-agent-rg \
     --secrets \
       foundry-api-key=keyvaultref:<key-vault-uri>/secrets/foundry-api-key,identityref:<identity-id>
   ```

---

## Scaling Configuration

### Auto-Scaling Rules

Update `infrastructure/bicep/main.bicep` scaling rules:

```bicep
scale: {
  minReplicas: 1
  maxReplicas: 10
  rules: [
    {
      name: 'http-scaling'
      http: {
        metadata: {
          concurrentRequests: '10'  // Scale at 10 concurrent requests
        }
      }
    }
    {
      name: 'cpu-scaling'
      custom: {
        type: 'cpu'
        metadata: {
          type: 'Utilization'
          value: '75'  // Scale at 75% CPU
        }
      }
    }
  ]
}
```

Apply:
```bash
az deployment group create \
  --resource-group claude-agent-rg \
  --template-file infrastructure/bicep/main.bicep \
  --parameters <your-parameters>
```

### Resource Limits

Adjust CPU and memory based on workload:

```bash
az containerapp update \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --cpu 1.0 \
  --memory 2.0Gi
```

**Cost Impact**:
- 0.5 CPU / 1.0 GB: ~$15/month (baseline)
- 1.0 CPU / 2.0 GB: ~$30/month (higher throughput)

---

## Monitoring & Troubleshooting

### View Logs

```bash
# Real-time logs
az containerapp logs show \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --follow

# Last 100 lines
az containerapp logs show \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --tail 100
```

### Check Revisions

```bash
# List revisions
az containerapp revision list \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --output table

# Rollback to previous revision
az containerapp revision activate \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --revision <revision-name>
```

### Common Issues

#### 1. Container App Not Starting

**Symptom**: App shows "Provisioning" or "Failed" status

**Diagnosis**:
```bash
az containerapp show \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --query "properties.latestRevisionFqdn"
```

**Common Causes**:
- Invalid ACR credentials
- Missing required environment variables
- Image not found in registry

**Fix**:
```bash
# Verify ACR access
az acr login --name claudeagenacr001

# Check environment variables
az containerapp show \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --query "properties.template.containers[0].env"
```

#### 2. Foundry API Errors

**Symptom**: Logs show "Authentication failed" or "Model not found"

**Diagnosis**:
```bash
# Check logs for error details
az containerapp logs show \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --grep "error"
```

**Common Causes**:
- Incorrect API key
- Wrong Foundry base URL
- Model not deployed in Foundry project

**Fix**:
```bash
# Update secrets
az containerapp secret set \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --secrets foundry-api-key="correct_key"
```

#### 3. High Latency

**Symptom**: Analysis takes > 30 seconds

**Diagnosis**:
```bash
# Check Application Insights for latency breakdown
az monitor app-insights query \
  --app claude-agent-insights \
  --analytics-query "requests | summarize avg(duration) by name"
```

**Common Causes**:
- Foundry endpoint in different region (cross-region latency)
- Insufficient CPU allocation
- Large resource exports

**Fix**:
```bash
# Increase CPU
az containerapp update \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --cpu 1.0 \
  --memory 2.0Gi
```

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure Container Apps

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build and push to ACR
        run: |
          az acr build \
            --registry ${{ secrets.ACR_NAME }} \
            --image azure-resource-analyzer:${{ github.sha }} \
            --image azure-resource-analyzer:latest \
            --file Dockerfile \
            .

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name azure-resource-analyzer \
            --resource-group claude-agent-rg \
            --image ${{ secrets.ACR_NAME }}.azurecr.io/azure-resource-analyzer:${{ github.sha }}
```

### Azure DevOps

Create `azure-pipelines.yml`:

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: AzureCLI@2
    displayName: 'Build and Deploy'
    inputs:
      azureSubscription: 'Azure-Connection'
      scriptType: 'bash'
      scriptLocation: 'inlineScript'
      inlineScript: |
        az acr build \
          --registry $(ACR_NAME) \
          --image azure-resource-analyzer:$(Build.BuildId) \
          --file Dockerfile \
          .

        az containerapp update \
          --name azure-resource-analyzer \
          --resource-group claude-agent-rg \
          --image $(ACR_NAME).azurecr.io/azure-resource-analyzer:$(Build.BuildId)
```

---

## Production Hardening

### Network Isolation

1. **Create VNet**:
   ```bash
   az network vnet create \
     --resource-group claude-agent-rg \
     --name claude-agent-vnet \
     --address-prefix 10.0.0.0/16 \
     --subnet-name aca-subnet \
     --subnet-prefix 10.0.0.0/23
   ```

2. **Deploy Container App to VNet**:
   ```bash
   az containerapp env create \
     --name claude-agent-env \
     --resource-group claude-agent-rg \
     --location eastus2 \
     --infrastructure-subnet-resource-id <subnet-id> \
     --internal-only
   ```

### Custom Domain & TLS

1. **Add Custom Domain**:
   ```bash
   az containerapp hostname add \
     --name azure-resource-analyzer \
     --resource-group claude-agent-rg \
     --hostname analyzer.yourdomain.com
   ```

2. **Bind Certificate** (Container Apps auto-provisions Let's Encrypt):
   ```bash
   az containerapp hostname bind \
     --name azure-resource-analyzer \
     --resource-group claude-agent-rg \
     --hostname analyzer.yourdomain.com \
     --environment claude-agent-env \
     --validation-method CNAME
   ```

### Health Checks

Update Dockerfile:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1
```

Configure in Container App:
```bash
az containerapp update \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --set-env-vars HEALTH_CHECK_ENABLED=true
```

---

## Cost Optimization

### Scale to Zero

Enable scale-to-zero for dev/test environments:
```bash
az containerapp update \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --min-replicas 0 \
  --max-replicas 3
```

**Cost Impact**: $0 when idle, auto-starts on first request (cold start: ~5 seconds)

### Scheduled Scaling

Use Azure Automation to scale down after hours:
```bash
# Scale down at 6 PM
az containerapp update \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --min-replicas 0

# Scale up at 8 AM
az containerapp update \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg \
  --min-replicas 1
```

---

## Cleanup

Remove all deployed resources:

```bash
# Delete resource group (removes all resources)
az group delete \
  --name claude-agent-rg \
  --yes \
  --no-wait
```

Or delete individual resources:
```bash
# Delete Container App
az containerapp delete \
  --name azure-resource-analyzer \
  --resource-group claude-agent-rg

# Delete Container Apps Environment
az containerapp env delete \
  --name claude-agent-env \
  --resource-group claude-agent-rg

# Delete Container Registry
az acr delete \
  --name claudeagenacr001 \
  --resource-group claude-agent-rg
```

---

## Next Steps

1. **Configure Custom Analysis**: Modify `.claude/CLAUDE.md` and subagent definitions
2. **Add More Subagents**: Create new agents in `.claude/agents/`
3. **Integrate with Azure APIs**: Add Azure SDK for live resource analysis
4. **Set Up Alerts**: Configure Application Insights alerts on errors or latency
5. **Run Load Tests**: Validate scaling behavior under load

For support, see [Troubleshooting](#monitoring--troubleshooting) or open an issue on GitHub.
