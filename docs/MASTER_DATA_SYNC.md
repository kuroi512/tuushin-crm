# Master Data Sync

This document explains how external CRM option lists (types, ownership, customer, agent, country, port, area, exchange, sales, manager) are synchronized into the local database as master data.

## Overview

External Endpoint (source):

```
https://burtgel.tuushin.mn/api/crm/get-options
```

The response contains multiple arrays. We store them in a unified table `master_options` via the Prisma model `MasterOption`.

### Data Model

```
model MasterOption {
  id         String         @id @default(cuid())
  category   MasterCategory
  name       String
  externalId String?        @unique // null => internal-only row (not from external system)
  source     MasterSource   @default(EXTERNAL)
  code       String?
  meta       Json?
  isActive   Boolean        @default(true)
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
}
```

`externalId` matches the source item's id (GUID / number) for idempotent upserts.
If `externalId` is `null`, the entry is INTERNAL (manually created) and will never be overwritten or auto-deactivated by sync.
Items not present anymore in a category during a sync are soft-deactivated (`isActive=false`) ONLY if `source=EXTERNAL`.

### Categories

```
TYPE | OWNERSHIP | CUSTOMER | AGENT | COUNTRY | PORT | AREA | EXCHANGE | SALES | MANAGER
```

## Endpoints

### List Options

`GET /api/master?category=COUNTRY&search=chi`
Query Params:

- `category` (optional) filter by a `MasterCategory` value.
- `search` (optional) case-insensitive substring match on name.
- `include_inactive=true` (optional) include deactivated rows.

Response:

```
{
  "success": true,
  "data": [ { id, category, name, externalId, code, meta, isActive, createdAt, updatedAt }, ... ]
}
```

### Trigger Sync

`POST /api/master/sync`
Body (optional):

```
{ "endpoint": "https://custom-endpoint" }
```

## UI Management

An admin UI for master data now exists under the standalone path `/master`:

- `/master` redirects to `/master/type` (default category)
- Category-specific pages: `/master/type`, `/master/country`, `/master/agent`, etc.

Optional simple auth: set an env var
Features:

- Per-category pages (no dropdown) using slug → enum mapping.
- Table lists both EXTERNAL (read-only) and INTERNAL (editable) rows.
- Create button opens a modal to add an INTERNAL option (category is fixed for the slug page).
- Edit/Delete actions only for INTERNAL rows; EXTERNAL rows show a lock icon tooltip.
- Meta can be supplied as JSON; invalid JSON is rejected client-side.
- Sync button (top right) triggers external fetch + upsert via `POST /api/master/sync` and shows stats.

```
MASTER_SYNC_API_KEY=your_secret_key
Rules Enforced Client + Server:
- EXTERNAL rows cannot be updated or deleted (server returns 403 if attempted directly).
- DELETE endpoint requires `id` query param: `/api/master?id=<id>`.
- PATCH/POST use existing validation / fallback logic for resilience.

Then call with header `x-api-key: your_secret_key`.
Hooks (React Query):
- `useMasterOptions(category)` – list options.
- `useCreateMasterOption()` – create INTERNAL.
- `useUpdateMasterOption(category)` – update INTERNAL.
- `useDeleteMasterOption(category)` – delete INTERNAL.
Response:

```

{
"success": true,
"message": "Sync completed",
"stats": { "updated": X, "inserted": Y, "deactivated": Z }
}

```

Where:

- `inserted` = number of brand new external ids created this run
- `updated` = number of existing external ids that were refreshed (name / meta / etc.)
- `deactivated` = number of previously active external rows set to `isActive=false` because they disappeared from the source feed for their category

### Create Internal Option

`POST /api/master`
Body:

```

{ "category": "AREA", "name": "Custom Yard", "code": "CY1", "meta": { "note": "Local only" } }

```

Creates a row with `source=INTERNAL` and no `externalId`.

### Update Internal Option

`PATCH /api/master`
Body (only fields to change required):

```

{ "id": "<id>", "name": "Renamed Yard", "isActive": false }

```

Will fail with 403 if the row is `source=EXTERNAL`.

## Running Migration

After modifying the Prisma schema, run:

```

pnpm prisma migrate dev --name master_options_init

```

(Or `npx prisma migrate dev --name master_options_init` if not using pnpm scripts.)

Then regenerate the client (automatically done by migrate) and restart the dev server:

```

pnpm dev

````

## Scheduling Sync

You can:

1. Manually call the sync endpoint from an admin UI button.
2. Use a cron (e.g. GitHub Actions, external scheduler) hitting `/api/master/sync`.
3. Add a small server-side cron using a background job (if you deploy somewhere that supports it) invoking `syncMasterOptions` directly.

## Using Master Data in Forms

Fetch categories you need client-side with React Query:

```ts
const fetchCountries = async () => {
  const res = await fetch('/api/master?category=COUNTRY');
  const json = await res.json();
  return json.data;
};
````

Each option object has:

```
{ id, category, name, externalId, code, meta, isActive }
```

`source` is also present (EXTERNAL | INTERNAL).
Use `code` when present (currency code, country code). For people (SALES, MANAGER), detailed names are stored in `meta.firstName` & `meta.lastName`.

## Extending

If the external API adds a list (e.g. `vessels`):

1. Add a new enum value to `MasterCategory`.
2. Extend the mapper in `src/lib/master-sync.ts`.
3. Run `pnpm prisma migrate dev --name add_vessel_category`.

## Notes / Future Ideas

- Track separate counts for inserted vs updated (store a hash of meta/name to detect real changes).
- Add `source` column if multiple upstream systems will feed master data.
- Implement optimistic concurrency using version or lastSyncAt.
- Add UI management to edit or add a manual override row.
- Allow merge/convert an INTERNAL row into EXTERNAL if later matched to upstream.

## Troubleshooting

- If `Property 'masterOption' does not exist` TypeScript error occurs, ensure migration ran so the Prisma client is regenerated with the new model.
- If items not deactivating: confirm the upstream endpoint actually removed them; cached responses may interfere (we use `cache: 'no-store'`).

## UI Management

An admin UI for master data now exists at `/dashboard/master`:

Features:

- Category selector to switch between option groups.
- Table lists both EXTERNAL (read-only) and INTERNAL (editable) rows.
- Create button opens a modal to add an INTERNAL option (category fixed to current view).
- Edit/Delete actions only enabled for INTERNAL rows; EXTERNAL rows show a lock icon tooltip.
- Meta can be supplied as JSON in the form; invalid JSON is rejected client-side.

Rules Enforced Client + Server:

- EXTERNAL rows cannot be updated or deleted (server returns 403 if attempted directly).
- DELETE endpoint requires `id` query param: `/api/master?id=<id>`.
- PATCH/POST use existing validation / fallback logic for resilience.

Hooks (React Query):

- `useMasterOptions(category)` – lists options.
- `useCreateMasterOption()` – create INTERNAL.
- `useUpdateMasterOption(category)` – update INTERNAL.
- `useDeleteMasterOption(category)` – delete INTERNAL.

Stats & Sync remain unchanged; UI does not trigger sync yet (can be added with a button invoking `POST /api/master/sync`).

---

Prepared automatically by AI assistant.
