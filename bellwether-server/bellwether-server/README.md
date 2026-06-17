# Bellwether Server

A small Node service that prefetches economic data on a low-frequency background
schedule, caches it, and serves it to the Bellwether app as plain JSON. The app
reads pre-built data and loads almost instantly instead of running a live search
on every selection.

## What it serves

- **Macro history** for each economy and indicator, from the World Bank Open Data
  API. Free, no key required. This works out of the box.
- **Economic calendar** (upcoming releases with consensus and prior) and **monthly
  consensus-vs-actual** for the common prints (CPI, GDP, unemployment), from
  Trading Economics. Requires a Trading Economics key. Without a key the calendar
  is empty and the report falls back to the World Bank annual figure (actual and
  prior, no consensus).

## Requirements

Node 18 or newer (uses the built-in `fetch`).

## Run locally

```bash
cd bellwether-server
npm install
cp .env.example .env      # optional: edit values
npm start
```

The server boots on port 8787 and warms the cache a few seconds after start.
The first macro refresh fetches roughly 210 series, staggered, so it takes a
couple of minutes to fully populate. Endpoints return a clear "not cached yet"
state until then, and the app falls back to the World Bank direct call in the
meantime.

Check it is alive:

```bash
curl localhost:8787/api/health
```

## Connect the app

Open `bellwether.html` and set the backend URL near the top of the script:

```js
const API_BASE = 'http://localhost:8787';          // local
// const API_BASE = 'https://your-deploy-url';      // hosted
```

Leave it as `''` to run the app standalone (World Bank direct plus live lookups).
When set, the app reads macro, report and calendar from the backend, and still
falls back to the live path if the backend is unreachable.

## Environment variables

All optional. See `.env.example`.

- `PORT` — listen port (default 8787)
- `ORIGIN` — CORS origin; set to your app URL to lock it down (default `*`)
- `TE_KEY` — Trading Economics key; enables the calendar and monthly consensus.
  A free guest key (`guest:guest`) exists but only covers a handful of countries,
  so a paid key is needed for full coverage.
- `MACRO_CRON` — macro refresh schedule (default `15 6 * * *`, once daily)
- `CALENDAR_CRON` — calendar refresh schedule (default `30 6,18 * * *`, twice daily)
- `STAGGER_MS` — delay between upstream calls during a refresh (default 900)
- `WARM_DELAY_MS` — delay before the first warm refresh after boot (default 8000)

The refresh cadence is deliberately low. Macro history changes rarely, so once a
day is already generous; the calendar runs twice a day to pick up new prints. Raise
or lower these with the cron variables.

## Endpoints

- `GET /api/health` — status, last refresh times, whether a TE key is set
- `GET /api/meta` — the economies and indicators lists
- `GET /api/macro/:iso/:code` — historical series plus latest and prior
- `GET /api/calendar/:iso` — upcoming and very recent releases
- `GET /api/report/:iso/:code` — latest release as expected, actual and prior
- `POST /api/refresh` — trigger a refresh now (handy right after a deploy)

ISO codes are three-letter (USA, AUS, GBR, ...). Indicator codes are the World
Bank codes listed in `src/config.js`.

## Deploy

It is a standard Node web service, so it runs on Render, Railway, Fly.io, a VPS,
or anything that runs Node. Set the environment variables in the host dashboard,
deploy, then set `API_BASE` in the app to the deployed URL. The cache persists to
`cache.json` on disk; on hosts with an ephemeral filesystem the cache simply
rebuilds on the next scheduled refresh.

A note on cost and limits: World Bank is free and tolerant of the staggered daily
refresh. Trading Economics is a paid product beyond the limited guest key; the
twice-daily, one-call-per-country pattern keeps usage low.

## Files

```
bellwether-server/
  server.js          Express app, routes, background scheduler
  src/config.js      economies, indicators, provider mapping, schedule
  src/cache.js       in-memory cache with JSON persistence
  src/providers.js   World Bank + Trading Economics fetchers and shape helpers
  .env.example       configuration template
```
