# ADR 0001 — Single-tenant for now; `TenantId` is a deliberate seam

Status: Accepted · Date: 2026-09-20

## Context
Every `BaseEntity` carries a `TenantId`, stamped to a fixed `DefaultTenantId` on save. No query
filter enforces tenant isolation, so the column looked half-built ("vestigial multi-tenancy") in the
architecture review. Label_Vihitha is one boutique's system, not a SaaS product today.

## Decision
Remain **single-tenant**. Keep the `TenantId` column as an intentional forward-compatibility seam,
but do not pretend it provides isolation:
- No per-request tenant resolution and no global tenant query filter are added now.
- The column is retained (dropping it across ~21 tables is a large, risky migration for zero present
  benefit) and documented as a seam, not an unfinished feature.

## If we go multi-tenant later
1. Add an `ITenantContext` resolved from the JWT (a `tenant` claim) per request.
2. Add a global query filter `HasQueryFilter(e => e.TenantId == _tenant.Current)` on every
   `BaseEntity` set, and stamp new rows from the context instead of `DefaultTenantId`.
3. Make unique indexes tenant-scoped (e.g. `(TenantId, SKU)` instead of `SKU`).
4. Backfill existing rows to their tenant and add tenant onboarding/admin.

## Consequences
- The review's "vestigial tenancy" gap is resolved by an explicit decision.
- The upgrade path above is cheap precisely because the column already exists.
