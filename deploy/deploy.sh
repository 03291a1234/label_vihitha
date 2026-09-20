#!/usr/bin/env bash
# Label_Vihitha — one-shot Azure deploy.
# Provisions infra (Bicep), then builds & publishes the API (which serves the Angular SPA).
#
# Prereqs: az CLI logged in (az login), .NET 8 SDK, Node 18+, and the values below.
# Nothing here is destructive to existing data; re-running redeploys code and updates infra.
set -euo pipefail

# ---- REQUIRED: set these (or export them before running) ----
RG="${RG:-rg-labelvihitha-demo}"
LOCATION="${LOCATION:-centralindia}"
NAME_PREFIX="${NAME_PREFIX:-labelvihitha}"
SQL_ADMIN="${SQL_ADMIN:-lvadmin}"
SQL_PASSWORD="${SQL_PASSWORD:?set SQL_PASSWORD (strong)}"
JWT_KEY="${JWT_KEY:-$(openssl rand -base64 48)}"
OWNER_PASSWORD="${OWNER_PASSWORD:?set OWNER_PASSWORD}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Resource group $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" -o none

echo "==> Deploying infrastructure (Bicep)"
OUT=$(az deployment group create -g "$RG" -f "$ROOT/deploy/main.bicep" \
  -p namePrefix="$NAME_PREFIX" location="$LOCATION" \
     sqlAdminLogin="$SQL_ADMIN" sqlAdminPassword="$SQL_PASSWORD" \
     jwtKey="$JWT_KEY" ownerPassword="$OWNER_PASSWORD" \
  --query properties.outputs -o json)

API_URL=$(echo "$OUT" | python3 -c "import sys,json;print(json.load(sys.stdin)['apiUrl']['value'])")
API_APP=$(echo "$OUT" | python3 -c "import sys,json;print(json.load(sys.stdin)['apiAppName']['value'])")
echo "    API:  $API_URL"

echo "==> Building Angular (prod, pointing at the API)"
pushd "$ROOT/web" >/dev/null
cat > src/environments/environment.prod.ts <<EOF
export const environment = { production: true, apiUrl: '$API_URL/api' };
EOF
npm ci
npx ng build --configuration production
popd >/dev/null

echo "==> Publishing the API + bundling the SPA into wwwroot"
PUB="$ROOT/.deploy-publish"
rm -rf "$PUB"
dotnet publish "$ROOT/src/LabelVihitha.Api/LabelVihitha.Api.csproj" -c Release -o "$PUB"
# Fold the built SPA into the API's wwwroot so one App Service serves both.
mkdir -p "$PUB/wwwroot"
cp -R "$ROOT/web/dist/labelvihitha-web/browser/." "$PUB/wwwroot/"

echo "==> Zip deploy to $API_APP"
ZIP="$ROOT/.deploy-publish.zip"
rm -f "$ZIP"
(cd "$PUB" && zip -qr "$ZIP" .)
az webapp deploy -g "$RG" -n "$API_APP" --src-path "$ZIP" --type zip -o none

echo "==> Done. App: $API_URL"
echo "    Sign in as owner (password you set) — the DB auto-migrates & seeds on first boot."
