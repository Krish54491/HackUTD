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
VITE_SPACETIME_DB=tango
```

Scans use an anonymous backend identity, separate from the simulated dashboard sign-in. No fake safety verdicts are generated if the backend is unavailable. Protection history and leaderboard are demo data; live account synchronization is not implemented.
