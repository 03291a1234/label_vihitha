// Label_Vihitha — Azure infrastructure.
// One Linux App Service (hosts the .NET API which also serves the Angular SPA, same-origin),
// an Azure SQL serverless database, and a Storage account for durable file uploads.
//
// Deploy with deploy.sh (recommended) or:
//   az deployment group create -g <rg> -f deploy/main.bicep -p @deploy/params.json

@description('Location for all resources. Central India by default (US regions are quota-blocked on this subscription).')
param location string = 'centralindia'

@description('Short name stem used to derive resource names (lowercase, 3-17 chars).')
@minLength(3)
@maxLength(17)
param namePrefix string = 'labelvihitha'

@description('Azure SQL administrator login.')
param sqlAdminLogin string

@description('Azure SQL administrator password.')
@secure()
param sqlAdminPassword string

@description('JWT signing key (>= 32 chars). Generate a strong random value.')
@secure()
param jwtKey string

@description('Owner (business admin) login password seeded into the app.')
@secure()
param ownerPassword string

@description('App Service plan SKU.')
param appServiceSku string = 'B1'

var suffix = uniqueString(resourceGroup().id)
var sqlServerName = toLower('${namePrefix}-sql-${suffix}')
var sqlDbName = 'LabelVihitha'
var storageName = toLower(substring('${namePrefix}st${suffix}', 0, 24))
var planName = '${namePrefix}-plan'
var apiAppName = toLower('${namePrefix}-api-${suffix}')

// ---------------- Storage (durable uploads) ----------------
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
  }
}
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}
resource uploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'uploads'
  properties: { publicAccess: 'Blob' }
}

// ---------------- Azure SQL (serverless) ----------------
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
  }
}
resource sqlDb 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: sqlDbName
  location: location
  sku: { name: 'GP_S_Gen5_1', tier: 'GeneralPurpose', family: 'Gen5', capacity: 1 } // serverless, 1 vCore
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
  }
}
// Allow other Azure services (the App Service) to reach SQL.
resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

// ---------------- App Service (API + SPA) ----------------
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: { name: appServiceSku }
  kind: 'linux'
  properties: { reserved: true }
}

var sqlConn = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${sqlDbName};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=True;TrustServerCertificate=False;'
var storageConn = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

resource apiApp 'Microsoft.Web/sites@2023-12-01' = {
  name: apiAppName
  location: location
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      alwaysOn: appServiceSku != 'F1'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      connectionStrings: [
        { name: 'Default', connectionString: sqlConn, type: 'SQLAzure' }
      ]
      appSettings: [
        { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
        { name: 'Jwt__Key', value: jwtKey }
        { name: 'Seed__OwnerPassword', value: ownerPassword }
        { name: 'Storage__Provider', value: 'AzureBlob' }
        { name: 'Storage__Container', value: 'uploads' }
        { name: 'Storage__BlobConnectionString', value: storageConn }
        { name: 'Cors__AllowedOrigins__0', value: 'https://${apiAppName}.azurewebsites.net' }
      ]
    }
  }
}

output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output apiAppName string = apiAppName
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output storageAccount string = storage.name
