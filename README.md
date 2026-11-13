# Livestock Manager v5.0 — Isolated Test Preview

**This is NOT your current live Livestock Manager website. Do not deploy this
branch/repository to the existing production Render or Netlify service.**

## What changed

- **Individual animal records**: each animal has its own `(account, animal_id)`
  PostgreSQL row, optimistic version and controlled PATCH endpoint.
- **Photos stored separately in PostgreSQL** from animal details. A phone photo
  and laptop weight change do not compete for the same database version.
- **Clean test farm**: never imports the v4 `livestockAnimals` cloud document or
  automatically migrates v4 conflict metadata. New test database recommended.
- **Offline drafts**: pending changes stay on the device and retry on reconnect.
- **Meaningful sync status**: `Cloud synced` requires successful API read or
  confirmed API write plus a new read, rather than an empty local queue.
- **Safer login**: transient network failures no longer log the user out or
  erase the stored session identity.
- **Existing screens retained**: registration, photos, growth, breeding,
  pedigree, vaccinations, reports, and dashboard continue to use the original
  frontend and storage interface.

Other types of farm records continue to use **versioned document groups** while
we validate the animal-specific sync changes; those still need broader multi-
writer validation before a production promotion.

## Install the isolated test service

Read **`docs/V5-PREVIEW-DEPLOYMENT.md`** before connecting any database.
It uses a NEW Render PostgreSQL database and a NEW Render web service that
serves the frontend on the same domain. Do not point the preview to the existing
production database and do not set up the old Netlify production proxy.

## Test without deploying

```bash
cd backend
npm run check
npm test
```

`npm test` uses Node built-ins and mocked database/API requests. It does **not**
need a live PostgreSQL database. For the actual HTML interface smoke test:

```bash
pip install playwright
playwright install chromium
python tests/browser-inline-smoke.py
```

The browser test loads your real frontend code and form controls with an isolated
in-memory fake API. It does **not** replace testing against a real hosted
PostgreSQL database on phone and laptop.

Review **`docs/V5-TEST-REPORT.md`** and **`docs/V5-RELEASE-GATE.md`** before
considering a production release.
