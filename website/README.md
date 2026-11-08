# Tango dashboard

React, TypeScript, Tailwind CSS, and Vite implementation of [Web-docs.md](Web-docs.md).

```sh
cd website
npm install
npm run dev
```

Run `npm run build` for a type-checked production build, `npm test` for data/filter checks, and `npm run preview` to serve the build.

The app starts signed out. Sign in loads the fictional QuietOrbit demo, including 128 log records, filters, CSV export, scam details, service concepts, and an opt-in leaderboard. Account and privacy changes are in memory and reset on refresh. Static sidebar/footer items intentionally do nothing, per the spec.

Website checks use the same Spacetime HTTP client and reducers as the extension. The Spacetime module and registered backend worker must be running for uncached checks. Optional `.env` configuration:

```dotenv
VITE_SPACETIME_HOST=https://maincloud.spacetimedb.com
VITE_SPACETIME_DB=protego
```

Scans use an anonymous backend identity, separate from the simulated dashboard sign-in. No fake safety verdicts are generated if the backend is unavailable. Protection history and leaderboard are demo data; live account synchronization is not implemented.

**Report a hornet** lets anyone report a scam website Tango missed. It opens from the sidebar, the **Spot a hornet Tango missed?** card under the leaderboard preview, or the link at the bottom of **Check a website** (prefilled with the checked site). Reports are live and shared with the browser extension and phone app through the `report_site` reducer. The browser keeps one anonymous identity in `localStorage` (`tango.reporter-token`) so re-reporting a site updates the earlier report and the daily limit applies. Check results also show how many people reported the site.
