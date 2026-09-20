#!/usr/bin/env bash
# Code-only redeploy of the API (no Bicep, no connection-string changes) — so the
# LabelVihitha2 data DB the app currently points at is preserved. Reuses the already-built
# Angular SPA in web/dist if present; rebuilds it only when missing.
set -euo pipefail

RG="rg-labelvihitha-demo"
APP="labelvihitha-web"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$ROOT/web/dist/labelvihitha-web/browser" ]; then
  echo "==> Building Angular (dist missing)"
  API_URL="https://$APP.azurewebsites.net"
  cat > "$ROOT/web/src/environments/environment.prod.ts" <<EOF
export const environment = { production: true, apiUrl: '$API_URL/api' };
EOF
  (cd "$ROOT/web" && npm ci && npx ng build --configuration production)
fi

echo "==> Publishing the API + bundling the SPA"
PUB="$ROOT/.deploy-publish"
rm -rf "$PUB"
dotnet publish "$ROOT/src/LabelVihitha.Api/LabelVihitha.Api.csproj" -c Release -o "$PUB"
mkdir -p "$PUB/wwwroot"
cp -R "$ROOT/web/dist/labelvihitha-web/browser/." "$PUB/wwwroot/"

echo "==> Zip deploy to $APP"
ZIP="$ROOT/.deploy-publish.zip"
rm -f "$ZIP"
(cd "$PUB" && zip -qr "$ZIP" .)
az webapp deploy -g "$RG" -n "$APP" --src-path "$ZIP" --type zip -o none

echo "==> Done. Owner logins are seeded on startup (himaja / samhitha)."
