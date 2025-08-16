# Tuushin CRM — Quotation-First MVP Workflow

Goal: Focus only on Quotation + Reporting. No shipments, customs, finance, or master data for MVP.

Roles
- Admin: manage users, see all quotations + reports
- Sales: create/update quotations, generate offers/printables

Navigation (MVP)
- Quotations
- Reports

Data Model (MVP)
- User { id, name, email, role: ADMIN|SALES }
- Quotation { id, quotationNumber, status, client fields (inline), cargo, route, pricing, validity, priority, assignedTo }
  - Offer versions (optional later)

Permissions
- Sales: CRUD own quotations
- Admin: CRUD all, view reports

KPIs (Reports)
- Quotations created (by user/time)
- Offers sent
- Approved rate (approved/total)
- Conversion-ready (valid & approved)

Phases
1) Create quotation form + list/table
2) Edit/update quotation, add “Offer” view/print
3) Simple reports dashboard (KPIs above)
4) Optional: export PDF/CSV

Notes
- Keep enums small; add roles later when requested
- Use NextAuth; seed one Admin and one Sales
- Migrations only for User + Quotation tables in MVP
