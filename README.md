# Label_Vihitha — Boutique Order & Inventory Management

Multi-platform order & inventory system for the Label_Vihitha women's boutique
(inventory → orders/invoicing → analytics → mobile). Built in phases.

## Tech stack

| Layer | Tech |
|---|---|
| API | ASP.NET Core Web API (.NET 8), Clean Architecture |
| ORM | EF Core 8 (code-first migrations), SQL Server |
| Auth | ASP.NET Identity + JWT (roles: Owner, Staff, ReadOnly) |
| Validation | FluentValidation |
| Web (Phase 3) | Angular 18 standalone + Angular Material |
| Mobile (Phase 5) | .NET MAUI |

## Solution layout

```
src/
  LabelVihitha.Domain          entities, enums (no dependencies)
  LabelVihitha.Application      DTOs, service interfaces + impls, validators
  LabelVihitha.Infrastructure   EF Core DbContext, migrations, Identity, JWT, seeding
  LabelVihitha.Api              controllers, middleware, DI composition
```

## Prerequisites

- .NET 8 SDK
- SQL Server (a local container is provided)

## Run locally

1. **Start SQL Server** (Docker):

   ```bash
   docker compose up -d
   ```

   Or, ad hoc:

   ```bash
   docker run -d --name lv-sql -e "ACCEPT_EULA=Y" \
     -e "MSSQL_SA_PASSWORD=Your_password123" -p 1433:1433 \
     mcr.microsoft.com/mssql/server:2022-latest
   ```

2. **Run the API** — migrations are applied and seed data inserted on first startup:

   ```bash
   dotnet run --project src/LabelVihitha.Api
   ```

   Swagger UI: the app prints its URL (e.g. `http://localhost:5080/swagger`).

3. **Log in** to get a JWT (seeded Owner account):

   | Field | Value |
   |---|---|
   | username | `owner` |
   | password | `Owner#12345` |

   ```bash
   curl -X POST http://localhost:5080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"userName":"owner","password":"Owner#12345"}'
   ```

   Send the returned `accessToken` as `Authorization: Bearer <token>`.

> Connection string, JWT key, seed credentials and CORS origins live in
> `src/LabelVihitha.Api/appsettings.json`. **Change the JWT key and seed password
> before any real deployment.**

### Web app (Angular)

With the API running, start the Angular dev server:

```bash
npm --prefix web start
```

Open `http://localhost:4200` and sign in with the seeded owner account. The API base
URL is set in `web/src/environments/environment.ts`; the API's `Cors:AllowedOrigins`
must include the origin you load the app from (`localhost:4200` and `127.0.0.1:4200`
are allowed by default).

## Configuration notes

- Money is `decimal(18,2)`; dates are stored in UTC.
- Soft deletes via `IsDeleted` (global query filters) — historical orders keep their references.
- `Product.RowVersion` is a concurrency token to prevent overselling.
- Entities carry a `TenantId` placeholder (single boutique today; SaaS-ready later).

## Build phases

- [x] **Phase 1 — Core Data & API**: Category + Product CRUD, EF migrations, JWT auth, seed data. *(all entities & the full DB schema are defined up front; CRUD endpoints ship per phase)*
- [x] **Phase 2 — Order & Invoicing**: Customer CRUD; Orders with price snapshots, stock control & status transitions; Invoice generation + partial/split Payments; OrderFollowUp create/resolve + dashboard.
- [x] **Phase 3 — Angular web UI** (`web/`): Angular 18 standalone + Material. JWT login, role-aware nav shell, and feature screens for Categories, Inventory, Customers, Orders (list / create wizard / detail with line editing, status actions, invoicing & follow-ups), Invoicing (list / detail / record payment), and a Follow-ups dashboard.
- [x] **Phase 4 — Analytics**: Owner-only `ReportsController` / `AnalyticsService` (summary KPIs, margin by category & date bucket, sales-by-category, discounts, inventory valuation, payment-methods, top/slow movers, follow-ups). Angular dashboard with KPI cards and Chart.js charts (margin bars, revenue-share & payment doughnuts, inventory bars, margin-trend line), mover tables, and a date-range filter.
- [ ] Phase 5 — .NET MAUI mobile app

## EF migrations

```bash
dotnet dotnet-ef migrations add <Name> \
  --project src/LabelVihitha.Infrastructure \
  --startup-project src/LabelVihitha.Api \
  --output-dir Persistence/Migrations
```
