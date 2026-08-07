# Carbon Footprint — Research, Prototype & App

Standalone static HTML/CSS/JS files. **This subfolder does not participate in the Next.js build** — no imports, no shared dependencies, no routing. It is safe to add, edit or remove without affecting the rest of the Systemeta app.

## Contents

- **index.html** — Login/signup + full personal carbon-tracker app (dashboard, activity logging, history, goals, insights, profile). Client-side auth (SHA-256 hashed passwords, per-user data in `localStorage`).
- **carbon-report.html** — Internal research & module-plan report: Scope 1/2/3 framework, audit of the current in-ERP carbon module, proposed 8-module standalone app, AI roadmap, phased build plan.
- **carbon-mvp.html** — Working Phase 1 + 2 prototype of the standalone app: organisation & site setup, Scope 1/2/3 activity engine, supplier questionnaire portal, CSV import + simulated ERP sync, BRSR Core / GHG Protocol report exports.
- **carbon-ledger.html** — Consumer-facing everyday carbon tracker (transport, energy, food, goods).
- **foodprint.html** — Food-only carbon tracker with a 14-day trend and swap suggestions.

## Local preview

Open any HTML file directly in a browser, or serve the folder:

```bash
cd carbon-footprint
python -m http.server 8000
# then http://localhost:8000/
```

## Notes

- No build step, no npm dependencies added to the Systemeta workspace.
- All user data (accounts, activity entries) is stored in the browser's `localStorage` — this is a demo/prototype auth setup, not production-grade security.
- Emission factors: DEFRA (UK), CEA India, IPCC — indicative planning estimates, not a certified audit.
