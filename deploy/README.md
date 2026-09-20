# Deploying Label_Vihitha to Azure

One Linux **App Service** hosts the .NET 8 API, which also serves the Angular SPA (same-origin,
no CORS juggling). Data lives in a serverless **Azure SQL** database; uploaded bills/photos live in
a **Storage account** (durable, unlike local disk). The DB auto-migrates and seeds on first boot.

```
Browser ──▶ App Service (API + Angular SPA)
                 ├──▶ Azure SQL (serverless)
                 └──▶ Blob Storage (uploads)
```

## What you provide

| Value | Notes |
|-------|-------|
| **Azure subscription** | `az login` (or a service principal). I can't authenticate for you. |
| **Resource group** | e.g. `rg-labelvihitha-demo` — created if missing. |
| **Region** | `centralindia` by default (US is quota-blocked on your subscription). |
| **SQL admin login + password** | A login name and a strong password you choose. |
| **Owner password** | The business-admin password seeded into the app. |
| **JWT signing key** | Optional — the script generates a strong one if you don't supply it. |

No secrets are committed. They're passed at deploy time and stored as App Service settings
(`Jwt__Key`, `Seed__OwnerPassword`, `Storage__BlobConnectionString`, and the SQL connection string).

## Steps

```bash
az login                       # authenticate (once)
export SQL_PASSWORD='<Strong#Passw0rd>'
export OWNER_PASSWORD='<owner-login-password>'
# optional overrides: RG, LOCATION, NAME_PREFIX, SQL_ADMIN, JWT_KEY
./deploy/deploy.sh
```

The script provisions infra, builds the Angular app pointed at the new API URL, publishes the API
with the SPA folded into `wwwroot`, and zip-deploys it. It prints the live URL at the end.

## Notes & guardrails
- The API **refuses to start** in Production with the shipped dev JWT key — supply a real one.
- SQL is **serverless** (auto-pauses after 60 min idle) to keep demo cost low; first request after
  a pause takes a few seconds to resume.
- Storage `Provider=AzureBlob` is set automatically; blobs are public-read so the SPA links them.
- To use a custom domain, add it to the App Service and append it to `Cors__AllowedOrigins`.
- Re-running `deploy.sh` redeploys code and reconciles infra without touching data.
