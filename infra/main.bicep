@description('Azure region for all resources.')
param location string = 'norwayeast'

@description('Short workload name used as the naming prefix.')
param workload string = 'markr'

@description('Container image reference (e.g. ghcr.io/owner/markr:sha).')
param imageRef string

@description('GHCR username for image pull.')
param registryUsername string = ''

@description('GHCR PAT for image pull.')
@secure()
param registryPassword string = ''

@description('Firebase project ID — used by the backend for token audience/issuer.')
param firebaseProjectId string

var suffix = uniqueString(resourceGroup().id)

// --- Storage ---
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${workload}${take(suffix, 4)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource projectsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'projects'
  properties: { publicAccess: 'None' }
}

// --- Managed Identity for the Container App ---
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${workload}'
  location: location
}

// Storage Blob Data Contributor role
var blobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, appIdentity.id, blobDataContributorRoleId)
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      blobDataContributorRoleId
    )
  }
}

// --- Log Analytics ---
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${workload}'
  location: location
  properties: {
    retentionInDays: 30
    sku: { name: 'PerGB2018' }
  }
}

// --- Container Apps Environment ---
resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${workload}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// --- Container App ---
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${workload}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: empty(registryUsername) ? [] : [
        {
          server: 'ghcr.io'
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: empty(registryPassword) ? [] : [
        {
          name: 'registry-password'
          value: registryPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'app'
          image: imageRef
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'FIREBASE_PROJECT_ID', value: firebaseProjectId }
            { name: 'STORAGE_ACCOUNT_NAME', value: storage.name }
            { name: 'BLOB_CONTAINER_NAME', value: 'projects' }
            { name: 'PORT', value: '8080' }
            { name: 'AZURE_CLIENT_ID', value: appIdentity.properties.clientId }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
    }
  }
}

output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output storageAccountName string = storage.name
output managedIdentityClientId string = appIdentity.properties.clientId
