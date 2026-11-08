# Tango

Scam protection across a browser extension, a web dashboard, and an Android app. Tango spots scam sites, slays them as hornets, and turns every kill into a collectible.

## What's in the repo

| Folder | What it is |
| --- | --- |
| `web-extension/` | Chrome extension (WXT, React). Scans pages and warns with an animated Tango alert. |
| `website/` | Dashboard (Vite, React). Your hive of slain hornets, leaderboard, badges, Hornets of the Week. |
| `backend/worker/` | Investigator agent (Node). Checks sites with NVIDIA Nemotron, web search, and Google Safe Browsing. |
| `backend/spacetime/` | SpacetimeDB module. Shared site reports between the worker, extension, and dashboard. |
| `phone-app/` | Android app (Kotlin, Jetpack Compose). See [phone-app/README.md](phone-app/README.md). |

## How it plays

1. **The warning.** On a risky site, a hornet sneaks out of the page and Tango rolls in and slays it. On high-risk sites the hornet gets sliced; on medium-risk sites Tango just rolls in.
2. **The T-Mobile brag.** Tango puts on a T-Mobile cape and says what T-Mobile has done about this kind of scam, then how Tango caught this one. Next waits for you.
3. **Why and what to do.** The reasons the site is risky, then a T-Mobile tip matched to the scam (Safe Web Browsing for phishing, SIM Protection for carrier impersonation, Scam Block for fake tech support, 7726 for scam texts).
4. **Three choices.** Leave site, continue to site, or open the dashboard in a new tab.
5. **One in a Krillion.** The dashboard takes the hornet unrated and asks you to send it down. The line sinks through the tiers by how few people have reported the site:

   | Tier | Hornet | Reports | Depth |
   | --- | --- | --- | --- |
   | Common | European hornet | 200+ | 100 m |
   | Uncommon | Yellow-legged hornet | 50+ | 300 m |
   | Rare | Lesser banded hornet | 10+ | 600 m |
   | Epic | Black-tailed hornet | 2+ | 850 m |
   | Legendary | Northern giant hornet | 0–1 | 1000 m |
   | Mythic | Crimson hornet | 1 in 1,000,000 roll | 1,000,000 m |

6. **The hive.** Add it to your hive, unlock badges, climb the leaderboard, and show it off on Hornets of the Week. Trophies post to Instagram, X, or Threads as a share image.

The Mythic tier is a real 1 in 1,000,000 roll on every new kill, using the browser's crypto random generator. Finding one unlocks the One in a million badge and a red leaderboard tag.

## Run it

You need Node 20+ and Chrome.

### Dashboard

```sh
cd website
npm install
npm run dev        # http://localhost:5173
```

### Extension

```sh
cd web-extension
npm install
npm run build      # load .output/chrome-mv3 in chrome://extensions (Developer mode → Load unpacked)
npm run dev        # or: Chrome with hot reload, from .output/chrome-mv3-dev
```

Reload the extension in `chrome://extensions` after each build. The Dashboard button opens `http://localhost:5173`, so keep the dashboard running.

### Demo scam site

```sh
cd web-extension
npm run demo       # http://localhost:4173
```

The demo is a fake scholarship page. `?level=medium` shows a medium-risk warning and `?level=safe` shows none.

### Backend (live scans)

```sh
cd backend/spacetime
npm install
npm run publish:local      # or publish:cloud

cd ../worker
cp .env.example .env       # add NVIDIA_API_KEY and GOOGLE_SAFE_BROWSING_KEY
npm install
npm run dev
```

Without `NVIDIA_API_KEY` the worker runs rules-only. The demo site works without the backend.

## Checks

```sh
cd website && npx tsc --noEmit -p . && npm test
cd web-extension && npm run compile
cd backend/worker && npm run typecheck && npm test
cd backend/spacetime && npm run typecheck && npm test
```

## Demo notes

- The dashboard user is the fictional **QuietOrbit**, with no Legendary hornets, so the demo kill comes up Legendary.
- New kills live only in the open dashboard tab. Refresh to reset and run the demo again.
- On a phone, share buttons open the system share sheet with the image and caption. On a computer, the image is saved and copied, and Instagram, X, or Threads opens so you can paste it.
