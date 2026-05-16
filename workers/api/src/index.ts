import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  getMongoClient,
  getDb,
  eventsCollection,
  fetchLogCollection,
  CITIES,
} from '@repo/shared'

interface Env {
  MONGODB_URL: string
  MONGODB_DB: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

// ─── Landing page ─────────────────────────────────────────────────────────────

app.get('/', (c) => {
  const base = new URL(c.req.url).origin
  const cities = CITIES.map((city) => city.slug)
  const cityCount = CITIES.length

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>City Event API</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f0f0f; color: #e2e2e2; line-height: 1.6; padding: 2rem 1rem; }
    .wrap { max-width: 820px; margin: 0 auto; }
    h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: .25rem; color: #fff; }
    .subtitle { color: #888; margin-bottom: 2.5rem; font-size: .95rem; }
    h2 { font-size: 1rem; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: .08em; margin: 2rem 0 .75rem; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 1.25rem 1.5rem; margin-bottom: .75rem; }
    .endpoint { display: flex; align-items: baseline; gap: .75rem; margin-bottom: .5rem; flex-wrap: wrap; }
    .method { background: #1d4ed8; color: #fff; font-size: .7rem; font-weight: 700; padding: .15rem .5rem; border-radius: 4px; letter-spacing: .05em; flex-shrink: 0; }
    .method.post { background: #15803d; }
    .path { font-family: "SF Mono", "Fira Code", monospace; font-size: .9rem; color: #7dd3fc; }
    .desc { color: #aaa; font-size: .88rem; }
    .params { margin-top: .75rem; display: flex; flex-direction: column; gap: .3rem; }
    .param { display: flex; gap: .75rem; font-size: .84rem; }
    .param-name { font-family: monospace; color: #f0abfc; min-width: 110px; flex-shrink: 0; }
    .param-desc { color: #999; }
    .links { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .9rem; }
    a.try { font-family: monospace; font-size: .78rem; background: #1e2a1e; color: #86efac; border: 1px solid #2d4a2d; padding: .3rem .7rem; border-radius: 5px; text-decoration: none; white-space: nowrap; }
    a.try:hover { background: #2d4a2d; }
    .pills { display: flex; flex-wrap: wrap; gap: .4rem; }
    .pill { font-family: monospace; font-size: .8rem; background: #1e1e2e; color: #c4b5fd; border: 1px solid #312e81; padding: .2rem .6rem; border-radius: 20px; }
    .status { display: flex; gap: 1rem; flex-wrap: wrap; }
    .stat { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: .9rem 1.2rem; flex: 1; min-width: 140px; }
    .stat-val { font-size: 1.5rem; font-weight: 700; color: #fff; }
    .stat-label { font-size: .8rem; color: #666; margin-top: .1rem; }
    footer { margin-top: 3rem; color: #444; font-size: .8rem; }
  </style>
</head>
<body>
<div class="wrap">
  <h1>City Event API</h1>
  <p class="subtitle">Aggregates events from Meetup, Eventbrite, and Luma across ${cityCount} US cities. Scraped every 2 hours.</p>

  <h2>Quick links</h2>
  <div class="links">
    <a class="try" href="${base}/events?limit=10">All upcoming events</a>
    ${CITIES.slice(0, 4).map((city) => `<a class="try" href="${base}/events?city=${city.slug}&limit=10">${city.name}</a>`).join('\n    ')}
    <a class="try" href="${base}/events?city=seattle&sort=rsvpCount&limit=10">Seattle · top RSVP</a>
    <a class="try" href="${base}/analytics/events-by-city">Events by city</a>
    <a class="try" href="${base}/analytics/top-rsvp">Top RSVP events</a>
    <a class="try" href="${base}/analytics/fetch-log">Scraper health</a>
  </div>

  <h2>Endpoints</h2>

  <div class="card">
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/events</span>
      <span class="desc">Query upcoming events with filters and sorting</span>
    </div>
    <div class="params">
      <div class="param"><span class="param-name">city</span><span class="param-desc">City slug — see list below. Omit for all cities.</span></div>
      <div class="param"><span class="param-name">source</span><span class="param-desc"><code>meetup</code> · <code>eventbrite</code> · <code>luma</code> — omit for all</span></div>
      <div class="param"><span class="param-name">sort</span><span class="param-desc"><code>startTime</code> (default, soonest first) · <code>rsvpCount</code> · <code>proximity</code></span></div>
      <div class="param"><span class="param-name">lat · lng</span><span class="param-desc">Required when <code>sort=proximity</code></span></div>
      <div class="param"><span class="param-name">limit</span><span class="param-desc">Max results, default 20, max 100</span></div>
      <div class="param"><span class="param-name">skip</span><span class="param-desc">Pagination offset, default 0</span></div>
      <div class="param"><span class="param-name">from · until</span><span class="param-desc">ISO date bounds, e.g. <code>2026-05-10T00:00:00Z</code></span></div>
    </div>
    <div class="links">
      <a class="try" href="${base}/events?city=seattle">seattle · startTime</a>
      <a class="try" href="${base}/events?city=seattle&sort=rsvpCount">seattle · rsvpCount</a>
      <a class="try" href="${base}/events?city=miami&source=meetup">miami · meetup only</a>
      <a class="try" href="${base}/events?sort=proximity&lat=37.775&lng=-122.419">proximity · SF coords</a>
      <a class="try" href="${base}/events?city=portland&limit=5&skip=0">portland · page 1</a>
    </div>
  </div>

  <div class="card">
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/events/:sourceId</span>
      <span class="desc">Single event by its source platform ID</span>
    </div>
    <div class="links">
      <a class="try" href="${base}/events/314506972">example Meetup event</a>
    </div>
  </div>

  <div class="card">
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/analytics/events-by-city</span>
      <span class="desc">Upcoming event count per city</span>
    </div>
    <div class="links">
      <a class="try" href="${base}/analytics/events-by-city">try it</a>
    </div>
  </div>

  <div class="card">
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/analytics/top-rsvp</span>
      <span class="desc">Top 20 upcoming events by RSVP count</span>
    </div>
    <div class="links">
      <a class="try" href="${base}/analytics/top-rsvp">try it</a>
    </div>
  </div>

  <div class="card">
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/analytics/events-by-source</span>
      <span class="desc">Event count per source per day (Grafana time series)</span>
    </div>
    <div class="links">
      <a class="try" href="${base}/analytics/events-by-source">try it</a>
    </div>
  </div>

  <div class="card">
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/analytics/rsvp-trends</span>
      <span class="desc">Daily avg and total RSVPs per source</span>
    </div>
    <div class="links">
      <a class="try" href="${base}/analytics/rsvp-trends">try it</a>
    </div>
  </div>

  <div class="card">
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/analytics/fetch-log</span>
      <span class="desc">Last 100 scraper run results — check for errors here</span>
    </div>
    <div class="links">
      <a class="try" href="${base}/analytics/fetch-log">try it</a>
    </div>
  </div>

  <div class="card">
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/analytics/cities</span>
      <span class="desc">City reference list with slugs, names, states</span>
    </div>
    <div class="links">
      <a class="try" href="${base}/analytics/cities">try it</a>
    </div>
  </div>

  <h2>City slugs</h2>
  <div class="card">
    <div class="pills">
      ${cities.map((s) => `<span class="pill">${s}</span>`).join('\n      ')}
    </div>
  </div>

  <footer>Scrapes Meetup · Eventbrite · Luma every 2 hours via Cloudflare Workers cron · Data stored in MongoDB</footer>
</div>
</body>
</html>`

  return c.html(html)
})

// ─── Events query ─────────────────────────────────────────────────────────────

// GET /events?city=seattle&source=meetup&limit=20&skip=0&from=2026-05-01&sort=startTime|rsvpCount|proximity&lat=47.6&lng=-122.3
app.get('/events', async (c) => {
  const mongo = getMongoClient(c.env.MONGODB_URL)
  await mongo.connect()
  const col = eventsCollection(getDb(mongo, c.env.MONGODB_DB))

  const {
    city,
    source,
    limit = '20',
    skip = '0',
    from,
    until,
    sort = 'startTime',
    lat,
    lng,
  } = c.req.query()

  const filter: Record<string, unknown> = {
    startTime: { $gte: from ? new Date(from) : new Date() },
  }
  if (until) (filter.startTime as Record<string, unknown>).$lte = new Date(until)
  if (city) filter.city = city
  if (source) filter.source = source

  let cursor = col.find(filter)

  if (sort === 'proximity' && lat && lng) {
    // Use $near for proximity sort — requires 2dsphere index
    cursor = col.find({
      ...filter,
      loc: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
        },
      },
    })
  } else if (sort === 'rsvpCount') {
    cursor = cursor.sort({ rsvpCount: -1 })
  } else {
    cursor = cursor.sort({ startTime: 1 })
  }

  const events = await cursor
    .skip(parseInt(skip))
    .limit(Math.min(parseInt(limit), 100))
    .project({ data: 0 }) // omit raw payload from API responses
    .toArray()

  await mongo.close()
  return c.json({ events, count: events.length })
})

// GET /events/:id
app.get('/events/:id', async (c) => {
  const mongo = getMongoClient(c.env.MONGODB_URL)
  await mongo.connect()
  const col = eventsCollection(getDb(mongo, c.env.MONGODB_DB))
  const event = await col.findOne(
    { sourceId: c.req.param('id') },
    { projection: { data: 0 } }
  )
  await mongo.close()
  if (!event) return c.json({ error: 'not found' }, 404)
  return c.json(event)
})

// ─── Grafana Infinity analytics endpoints ────────────────────────────────────
// In Grafana: add Infinity datasource → URL = https://event-api.<account>.workers.dev
// Each panel uses a different /analytics/* path, parser = JSON, root = "data"

// Events per source per day (time series)
app.get('/analytics/events-by-source', async (c) => {
  const mongo = getMongoClient(c.env.MONGODB_URL)
  await mongo.connect()
  const col = eventsCollection(getDb(mongo, c.env.MONGODB_DB))

  const rows = await col
    .aggregate([
      { $match: { startTime: { $gte: new Date() } } },
      {
        $group: {
          _id: {
            source: '$source',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ])
    .toArray()

  await mongo.close()
  return c.json({
    data: rows.map((r) => ({
      source: r._id.source,
      date: r._id.date,
      count: r.count,
    })),
  })
})

// Events per city
app.get('/analytics/events-by-city', async (c) => {
  const mongo = getMongoClient(c.env.MONGODB_URL)
  await mongo.connect()
  const col = eventsCollection(getDb(mongo, c.env.MONGODB_DB))

  const rows = await col
    .aggregate([
      { $match: { startTime: { $gte: new Date() } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()

  await mongo.close()
  return c.json({ data: rows.map((r) => ({ city: r._id, count: r.count })) })
})

// Top events by RSVP count
app.get('/analytics/top-rsvp', async (c) => {
  const mongo = getMongoClient(c.env.MONGODB_URL)
  await mongo.connect()
  const col = eventsCollection(getDb(mongo, c.env.MONGODB_DB))

  const rows = await col
    .find({ startTime: { $gte: new Date() }, rsvpCount: { $ne: null } })
    .sort({ rsvpCount: -1 })
    .limit(20)
    .project({ title: 1, city: 1, source: 1, rsvpCount: 1, startTime: 1, sourceUrl: 1, _id: 0 })
    .toArray()

  await mongo.close()
  return c.json({ data: rows })
})

// Worker fetch health log
app.get('/analytics/fetch-log', async (c) => {
  const mongo = getMongoClient(c.env.MONGODB_URL)
  await mongo.connect()
  const col = fetchLogCollection(getDb(mongo, c.env.MONGODB_DB))

  const rows = await col
    .find()
    .sort({ fetchedAt: -1 })
    .limit(100)
    .toArray()

  await mongo.close()
  return c.json({
    data: rows.map((r) => ({
      source: r.source,
      city: r.citySlug,
      fetchedAt: r.fetchedAt,
      found: r.eventsFound,
      upserted: r.eventsUpserted,
      durationMs: r.durationMs,
      error: r.error,
    })),
  })
})

// RSVP trend over time (daily avg per source)
app.get('/analytics/rsvp-trends', async (c) => {
  const mongo = getMongoClient(c.env.MONGODB_URL)
  await mongo.connect()
  const col = eventsCollection(getDb(mongo, c.env.MONGODB_DB))

  const rows = await col
    .aggregate([
      { $match: { rsvpCount: { $ne: null }, startTime: { $gte: new Date() } } },
      {
        $group: {
          _id: {
            source: '$source',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          },
          avgRsvp: { $avg: '$rsvpCount' },
          totalRsvp: { $sum: '$rsvpCount' },
          eventCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ])
    .toArray()

  await mongo.close()
  return c.json({
    data: rows.map((r) => ({
      source: r._id.source,
      date: r._id.date,
      avgRsvp: Math.round(r.avgRsvp),
      totalRsvp: r.totalRsvp,
      eventCount: r.eventCount,
    })),
  })
})

// Cities reference (for Grafana variables)
app.get('/analytics/cities', (_c) => {
  return Response.json({
    data: CITIES.map((c) => ({ slug: c.slug, name: c.name, state: c.state })),
  })
})

export default app
