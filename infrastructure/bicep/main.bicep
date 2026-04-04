param location string = 'eastus2'
param containerAppName string = 'azure-resource-analyzer'
param containerAppEnvName string = 'claude-agent-env'
param acrName string = 'claudeagenacr'
param imageName string = 'azure-resource-analyzer:latest'

@secure()
param foundryApiKey string

param foundryBaseUrl string
param foundryModel string = 'claude-sonnet-4-5'
param enableTracing bool = false
param enableEvaluation bool = false
param applicationInsightsConnectionString string = ''

// Container Apps Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
    }
  }
}

// Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'foundry-api-key'
          value: foundryApiKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: containerAppName
          image: '${acr.properties.loginServer}/${imageName}'
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
          env: [
            {
              name: 'FOUNDRY_API_KEY'
              secretRef: 'foundry-api-key'
            }
            {
              name: 'FOUNDRY_BASE_URL'
              value: foundryBaseUrl
            }
            {
              name: 'FOUNDRY_MODEL'
              value: foundryModel
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'ENABLE_TRACING'
              value: string(enableTracing)
            }
            {
              name: 'ENABLE_EVALUATION'
              value: string(enableEvaluation)
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: applicationInsightsConnectionString
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
