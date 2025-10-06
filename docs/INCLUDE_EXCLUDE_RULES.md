# Include / Exclude / Remark Rule Engine

This document captures the proposed workflow for managing Include / Exclude / Remark contents based on the Incoterm and Transport Mode combination. The goal is to let the operations team maintain reusable rule sets while keeping each quotation fully editable per deal.

## Data Model Overview

1. **Master Data Catalog**
   - Create a new master-data category, e.g. `quotation_rule_snippets`.
   - Each record stores a reusable snippet with these fields:
     - `id`
     - `label` – human-friendly name shown in the UI (e.g., “EXW Truck – Includes”).
     - `type` – enum: `include` | `exclude` | `remark`.
     - `incoterm` – optional Incoterm tag. `null` means any Incoterm.
     - `transportMode` – optional transport-mode tag. `null` means any mode.
     - `content` – multiline text (Markdown-safe) inserted into the quotation.
     - `isDefault` – boolean to indicate it should be preselected when rules match.
     - `order` – number for default ordering.
   - Snippets can be maintained in the existing master data UI so non-technical users manage the library.

2. **Default Rule Sets (Settings Screen)**
   - Provide a dedicated settings page where admins pick default snippets for each Incoterm + transport-mode combination.
   - Suggested schema:
     ```json
     {
       "key": "EXW|TRUCK",
       "include": ["snippet-id-1", "snippet-id-2"],
       "exclude": ["snippet-id-6"],
       "remark": ["snippet-id-12"]
     }
     ```
   - Store these mappings in Prisma (new table `quotation_rule_defaults`) with columns: `incoterm`, `transportMode`, `type`, `snippetIds` (JSON array), `order` (number), `updatedBy`.

## Quotation Workflow

1. **Quotation Creation / Edit**
   - When a user picks an Incoterm and transport mode, load candidate snippets:
     - All snippets with matching `incoterm` AND/OR matching `transportMode`.
     - Snippets where either tag is `null` are treated as global fallbacks.
   - Apply default selections from `quotation_rule_defaults` (or those marked `isDefault`) and display the combined lists in three tabs (Include, Exclude, Remark).
   - Users can:
     - Reorder via drag-and-drop.
     - Toggle snippets on/off.
     - Add additional snippets from the catalog search.
     - Edit text inline (per quotation) without mutating the master record. Inline edits are stored alongside the quotation (e.g., JSON `{ snippetId, customContent }`).

2. **Modal Interaction Pattern**
   - Primary textarea shows the current ordered text (read-only).
   - “Edit” or clicking the area opens a modal:
     - Left panel: available snippets grouped by type, searchable, with badges for Incoterm/Mode tags.
     - Right panel: selected snippets for that type (Include/Exclude/Remark). Users can reorder or remove items. Live preview updates as they reorder.
     - Provide an “Add custom line” option for ad-hoc entries stored only with the quotation.
   - Save closes the modal, updates the textarea, and keeps selection metadata for persistence.

3. **Persistence Model**
   - Store selections per quotation as:
     ```json
     {
       "include": [
         { "snippetId": "snippet-id-1" },
         { "snippetId": null, "content": "Custom note" }
       ],
       "exclude": [...],
       "remark": [...]
     }
     ```
   - On save, denormalize into the existing text fields (`include`, `exclude`, `remark`) for backwards compatibility while also persisting structured metadata for future automation.

4. **Print View Integration**
   - The print template continues to read from the plain-text fields, so no change is needed once the denormalized strings are updated.
   - Optionally display a “Source” hint (e.g., global vs. custom) in the internal UI for auditing.

## Maintenance Guidelines

- Provide role-based permissions so only authorized staff manage snippets and defaults.
- Surface audit trails (updatedBy, updatedAt) for snippet changes.
- Add seed data for the most common Incoterm + transport mode combinations to accelerate onboarding.
- Consider versioning snippets so historical quotations retain prior text if the master record is updated.

This design keeps the workflow flexible: admins curate the snippet library, defaults are applied automatically, and quotation owners retain full control over the final Include / Exclude / Remark sections.
