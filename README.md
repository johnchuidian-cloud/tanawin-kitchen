# Tanawin Kitchen

Mobile-first kitchen management app for Tanawin Bed & Breakfast (Bataan, PH).
Inventory, recipe costing, waste logging, and purchases with an owner-approval
queue — used by the owner remotely and kitchen staff on-site.

## Stack

- React + Vite (plain JS)
- Supabase (Postgres, shared project with Tanawin Finance — Kitchen reads
  Finance's `entries` table read-only, never writes to Finance tables)
- PIN-based login (no Supabase Auth), mirroring the Finance app
- Hosted on Cloudflare Workers (static assets)

## Key product rules

- Staff structural/financial changes (recipe edits, ingredient-line edits,
  purchases) queue in `approvals` for the admin; admin changes apply directly.
- Cost-per-serving recalculation is **manual only** (a button — never automatic).
- Menu price = cost per serving × 3, rounded up (₱).
- Recipes use fixed batch sizes: 2, 6, or 9 pax.
- Waste logging is a record only; stock truth comes from Count Stock.
- Finance import is read-only reconciliation: match a Finance purchase to an
  ingredient, confirm it physically arrived, sync. Item matches are remembered.

## Development

```
npm install
npm run dev
```

Create `.env.local` (not committed):

```
VITE_SUPABASE_URL=<project url>
VITE_SUPABASE_ANON_KEY=<publishable key>
```

Database migrations live in `supabase/` (numbered .sql files, run in the
Supabase SQL editor).

## Deploy

Cloudflare git-connected build: `npm run build`, output `dist/`, config in
`wrangler.jsonc` (SPA fallback enabled). Set the two `VITE_*` env vars in the
Cloudflare build settings.
