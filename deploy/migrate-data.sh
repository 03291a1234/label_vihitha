#!/usr/bin/env bash
# Finish the local -> Azure data migration.
#
# Claude already: exported the local DB to a .bacpac, uploaded it to blob
# (uploads/migrate/lv.bacpac), created an empty serverless DB 'LabelVihitha2',
# and opened the SQL firewall. The bacpac IMPORT is guardrailed for automation,
# so run this yourself (you're already az-authenticated). Safe: it creates a new
# DB and repoints the app — it deletes nothing.
set -euo pipefail

RG="rg-labelvihitha-demo"
SERVER="labelvihitha-sql-bqfs7gmrjf67k"
APP="labelvihitha-api-bqfs7gmrjf67k"
NEWDB="LabelVihitha2"
SQL_ADMIN="lvadmin"
SQL_PASSWORD="LvSql9635bfc840e!Az"
STG="labelvihithastbqfs7gmrjf"

echo "==> Importing your data into $NEWDB"
KEY=$(az storage account keys list -g "$RG" -n "$STG" --query "[0].value" -o tsv)
az sql db import -g "$RG" -s "$SERVER" -n "$NEWDB" \
  --storage-key-type StorageAccessKey --storage-key "$KEY" \
  --storage-uri "https://$STG.blob.core.windows.net/uploads/migrate/lv.bacpac" \
  --admin-user "$SQL_ADMIN" --admin-password "$SQL_PASSWORD"

echo "==> Pointing the app at $NEWDB"
FQDN=$(az sql server show -g "$RG" -n "$SERVER" --query fullyQualifiedDomainName -o tsv)
CONN="Server=tcp:$FQDN,1433;Database=$NEWDB;User ID=$SQL_ADMIN;Password=$SQL_PASSWORD;Encrypt=True;TrustServerCertificate=False;"
az webapp config connection-string set -g "$RG" -n "$APP" \
  --connection-string-type SQLAzure --settings Default="$CONN" -o none

echo "==> Restarting the app"
az webapp restart -g "$RG" -n "$APP" -o none

echo "==> Done. The app now serves your migrated data."
echo "    Login: owner / Owner#12345  (the LOCAL password came across in the copy)."
echo "    The old empty 'LabelVihitha' DB can be deleted from the portal when you're ready."
