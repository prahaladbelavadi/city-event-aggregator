# City Event Aggregator

Aggregates events from Meetup, Eventbrite, and Luma across multiple cities into a MongoDB store. Served via a Cloudflare Workers API and monitored in Grafana Cloud.

## Architecture

```
Cron (every 2h)
  └── worker-scraper
        ├── Meetup (GraphQL)
        ├── Eventbrite (POST /home/api/search/)
        └── Luma (REST API)
              └── MongoDB (Railway)

HTTP request
  └── event-api (Cloudflare Worker)
        ├── GET /events          — query events
        └── GET /analytics/*     — Grafana Infinity endpoints
```

## Live URLs

| | URL |
|---|---|
| **API landing page** | [https://event-api.belavadi.workers.dev](https://event-api.belavadi.workers.dev) |
| Scraper (cron) | `https://event-scraper.belavadi.workers.dev` |

Open the API landing page in a browser — it lists every endpoint with working links, query param reference, and city slugs. No separate docs needed.

---

## Command Reference

### First-time setup

```bash
# 1. Install all dependencies
npm install

# 2. Copy and fill in your credentials
cp .env.example .env

# 3. Push secrets to Cloudflare + deploy both workers in one shot
npm run setup
```

### Day-to-day

```bash
# Re-push secrets after updating .env (e.g. refreshed Eventbrite cookie)
npm run secrets

# Redeploy both workers after a code change
npm run deploy

# Redeploy a single worker
npm run deploy -w workers/scraper
npm run deploy -w workers/api
```

### Local development

```bash
# Run the API worker locally at http://localhost:8787
npm run dev:api

# Run the scraper worker locally (trigger manually via wrangler dev UI)
npm run dev:scraper

# Type-check all packages
npm run typecheck
```

### Adding a new city

```bash
# 1. Edit cities config — add slug, coords, eventbritePlaceId, lumaPlaceId
open packages/shared/src/cities.ts

# 2. Redeploy scraper to pick up the new city
npm run deploy -w workers/scraper
```

### Refreshing the Eventbrite cookie

```bash
# After updating EVENTBRITE_GUEST_COOKIE in .env:
npm run secrets
```

---

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- Wrangler logged in: `npx wrangler login`
- MongoDB connection string (Railway)
- Eventbrite guest cookie (see below)

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
MONGODB_URL=mongodb://user:password@host.railway.app:port/city-events?authSource=admin
MONGODB_DB=city-events
EVENTBRITE_GUEST_COOKIE=identifier%3D...
```

### Getting the Eventbrite guest cookie

1. Open Chrome/Firefox and go to `eventbrite.com`
2. Open DevTools → **Application** tab → **Cookies** → `https://www.eventbrite.com`
3. Find the cookie named `guest`
4. Copy the **Value** column — it looks like `identifier%3Dabc123%26a%3D1548...`
5. Paste it into `.env` as `EVENTBRITE_GUEST_COOKIE=`

This is a stable guest session identifier, not a login — it typically lasts weeks. If Eventbrite results stop appearing, refresh it the same way.

---

## Cities & Place IDs

Cities are configured in [`packages/shared/src/cities.ts`](packages/shared/src/cities.ts).

### Eventbrite place IDs

Each city has an `eventbritePlaceId` (Who's on First / WOF ID) used by the `POST /home/api/search/` endpoint. All 10 cities are pre-configured.

### Luma place IDs

Most Luma place IDs are marked `null` and need to be filled in. To find a city's ID:

1. Open `luma.com/discover` in a browser with DevTools → Network tab open
2. Click on the city you want
3. Find the request to `api2.luma.com/discover/bootstrap-page`
4. Copy the `featured_place_api_id` query parameter (format: `discplace-XXXXX`)
5. Set it in `cities.ts` for the matching city entry

Seattle is pre-configured: `discplace-FQ4E58PeBMHGTKK`.

---

## API Reference

| | Local (`npm run dev:api`) | Live |
|---|---|---|
| Base URL | `http://localhost:8787` | `https://event-api.belavadi.workers.dev` |

### Events

#### `GET /events`

Returns upcoming events, sorted by `startTime` ascending (soonest first) by default.

| Param | Description | Default |
|---|---|---|
| `city` | City slug e.g. `seattle` | all cities |
| `source` | `meetup` \| `eventbrite` \| `luma` | all sources |
| `sort` | `startTime` \| `rsvpCount` \| `proximity` | `startTime` |
| `limit` | Max results (max 100) | `20` |
| `skip` | Pagination offset | `0` |
| `from` | ISO date lower bound | now |
| `until` | ISO date upper bound | — |
| `lat` | Latitude (required when `sort=proximity`) | — |
| `lng` | Longitude (required when `sort=proximity`) | — |

```bash
# Soonest upcoming events in Seattle (default sort)
curl "http://localhost:8787/events?city=seattle"

# Sort by RSVP count — most popular first
curl "http://localhost:8787/events?city=seattle&sort=rsvpCount&limit=10"

# Sort by proximity to a coordinate
curl "http://localhost:8787/events?sort=proximity&lat=47.606&lng=-122.332"

# Filter by source
curl "http://localhost:8787/events?city=seattle&source=meetup"
curl "http://localhost:8787/events?city=new-york&source=luma"
curl "http://localhost:8787/events?city=san-francisco&source=eventbrite"

# Date window — next 7 days across all cities
curl "http://localhost:8787/events?until=2026-05-10T00:00:00Z&limit=50"

# Paginate
curl "http://localhost:8787/events?city=seattle&limit=20&skip=20"
```

City slugs: `seattle` `bellevue` `san-francisco` `palo-alto` `irvine` `los-angeles` `orange-county` `portland` `new-york` `miami`

#### `GET /events/:sourceId`

Returns a single event by its source platform ID.

```bash
curl "http://localhost:8787/events/314069382"
```

### Analytics (Grafana Infinity)

All endpoints return `{ "data": [...] }`.

```bash
# How many events per city
curl "http://localhost:8787/analytics/events-by-city"

# Top 20 events by RSVP count
curl "http://localhost:8787/analytics/top-rsvp"

# Scraper health — last 100 runs, errors shown
curl "http://localhost:8787/analytics/fetch-log"

# Events per source per day (time series)
curl "http://localhost:8787/analytics/events-by-source"

# Daily avg/total RSVPs per source
curl "http://localhost:8787/analytics/rsvp-trends"

# City reference list
curl "http://localhost:8787/analytics/cities"
```


---

## Grafana Setup

1. In Grafana Cloud → **Plugins** → install **Infinity** datasource
2. Add datasource → set base URL to `https://event-api.belavadi.workers.dev`
3. Create panels — each panel is a **GET** request to an `/analytics/*` endpoint
4. Set **Parser** = `JSON`, **Root** = `data`

Recommended panels:

| Panel | Endpoint | Type | Config |
|---|---|---|---|
| Events by source | `/analytics/events-by-source` | Time series | X=`date`, Y=`count`, series=`source` |
| Events by city | `/analytics/events-by-city` | Bar chart | X=`city`, Y=`count` |
| Top RSVP events | `/analytics/top-rsvp` | Table | columns: title, city, source, rsvpCount |
| Scraper health | `/analytics/fetch-log` | Table | highlight rows where `error` ≠ null |
| RSVP trends | `/analytics/rsvp-trends` | Time series | X=`date`, Y=`avgRsvp`, series=`source` |

---

## MongoDB Indexes

Run once after DB is provisioned to create indexes for geo queries, deduplication, and sorting:

```bash
node -e "
const { MongoClient } = require('mongodb');
require('dotenv').config();
async function run() {
  const c = new MongoClient(process.env.MONGODB_URL);
  await c.connect();
  const db = c.db(process.env.MONGODB_DB);
  await db.collection('events').createIndex({ source: 1, sourceId: 1 }, { unique: true });
  await db.collection('events').createIndex({ startTime: 1 });
  await db.collection('events').createIndex({ city: 1 });
  await db.collection('events').createIndex({ loc: '2dsphere' });
  await db.collection('events').createIndex({ rsvpCount: -1 });
  console.log('Indexes created');
  await c.close();
}
run();
"
```

---

## Troubleshooting

### Triggering the scraper manually

`npx wrangler cron trigger` does not exist. Use one of these instead:

**Via Cloudflare Dashboard** (deployed worker):
1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → `event-scraper` → **Triggers** tab → **Run**

**Via local dev** (runs against your real MongoDB):
```bash
# Terminal 1
cd workers/scraper && npx wrangler dev --test-scheduled

# Terminal 2
curl "http://localhost:8787/__scheduled?cron=0+*/2+*+*+*"
```

---

### Viewing live worker logs

```bash
# Stream logs from the deployed scraper
npx wrangler tail event-scraper --config workers/scraper/wrangler.toml

# Stream logs from the deployed API
npx wrangler tail event-api --config workers/api/wrangler.toml
```

---

### Scraper runs but no events appear

**Check the fetch log first:**
```bash
curl "https://event-api.belavadi.workers.dev/analytics/fetch-log"
```
Look for non-null `error` fields. Common causes:

| Error | Fix |
|---|---|
| `Eventbrite 403` | Eventbrite guest cookie expired — refresh it (see above) and re-run `npm run secrets` |
| `Meetup 400` / `PersistedQueryNotFound` | Meetup rotated the GraphQL hash — update `sha256Hash` in `workers/scraper/src/index.ts` by capturing a fresh `gql2` request from meetup.com in DevTools |
| `Luma 404` | `lumaPlaceId` is wrong or has changed — re-capture it from `luma.com/discover` |
| `No __NEXT_DATA__ found` | Eventbrite changed their page structure — the HTML parser needs updating |
| MongoDB timeout | Check Railway service is running and `MONGODB_URL` secret is set correctly |

---

### Secrets not set / worker crashes on startup

Verify secrets are attached to the worker:
```bash
npx wrangler secret list --config workers/scraper/wrangler.toml
npx wrangler secret list --config workers/api/wrangler.toml
```

Both should show `MONGODB_URL`. The scraper should also show `EVENTBRITE_GUEST_COOKIE`. If missing, re-run:
```bash
npm run secrets
```

---

### API returns empty events array

The scraper hasn't run yet, or ran with errors. Either trigger it manually (see above) or check:
```bash
# Confirm events exist in MongoDB
curl "https://event-api.belavadi.workers.dev/analytics/events-by-city"
```

If that returns `{ "data": [] }`, the DB is empty — trigger the scraper.

---

### Proximity sort returns no results

The `loc` field (GeoJSON point) must be populated and the `2dsphere` index must exist. Run the index setup script in the **MongoDB Indexes** section above if you haven't already.

Also confirm events have lat/lng — not all Meetup or Eventbrite events include venue coordinates (online events won't have them).

---

### Wrangler version warning

```
▲ [WARNING] The version of Wrangler you are using is now out-of-date.
```

Harmless but fixable:
```bash
npm install --save-dev wrangler@4
```

---

### Luma cities not returning events

Most cities have `lumaPlaceId: null` in [`packages/shared/src/cities.ts`](packages/shared/src/cities.ts) — Luma silently skips them. To populate a city:

1. Open `luma.com/discover` → select the city → DevTools Network tab
2. Find the `bootstrap-page` request to `api2.luma.com`
3. Copy the `featured_place_api_id` value (format: `discplace-XXXXX`)
4. Set it in `cities.ts`, then `npm run deploy -w workers/scraper`

---

### Eventbrite cookie refresh

Cookies typically last several weeks. Signs it's expired: Eventbrite results drop to zero in `/analytics/events-by-city` while Meetup and Luma still return data.

1. Go to `eventbrite.com` in your browser
2. DevTools → Application → Cookies → `https://www.eventbrite.com` → `guest` → copy Value
3. Update `EVENTBRITE_GUEST_COOKIE` in `.env`
4. `npm run secrets`
