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
    <a class="try" href="${base}/dashboard" style="background:#1e2a1e;color:#86efac;border-color:#2d4a2d;font-weight:700">🗓 Dashboard</a>
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

// ─── Dashboard UI ─────────────────────────────────────────────────────────────

app.get('/dashboard', (c) => {
  const base = new URL(c.req.url).origin
  const cityOptions = CITIES.map((city) =>
    `<option value="${city.slug}">${city.name}, ${city.state.toUpperCase()}</option>`
  ).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>City Events Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d0d0d; --surface: #161616; --border: #252525; --border2: #2e2e2e;
      --text: #e2e2e2; --muted: #888; --dim: #555;
      --meetup: #f64060; --eventbrite: #f05537; --luma: #8b5cf6;
      --green: #22c55e; --blue: #38bdf8; --yellow: #fbbf24;
    }
    html, body { height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); display: flex; flex-direction: column; }

    /* ── Top bar ── */
    header { background: var(--surface); border-bottom: 1px solid var(--border); padding: .75rem 1.25rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; position: sticky; top: 0; z-index: 10; }
    header h1 { font-size: 1rem; font-weight: 700; white-space: nowrap; color: #fff; }
    header h1 span { color: var(--muted); font-weight: 400; font-size: .85rem; margin-left: .4rem; }
    .filters { display: flex; gap: .5rem; flex-wrap: wrap; flex: 1; align-items: center; }
    select, input[type=text], input[type=date] {
      background: var(--bg); border: 1px solid var(--border2); color: var(--text);
      padding: .35rem .6rem; border-radius: 6px; font-size: .82rem; outline: none;
    }
    select:focus, input:focus { border-color: #555; }
    select { cursor: pointer; }
    .btn { padding: .35rem .8rem; border-radius: 6px; font-size: .82rem; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #1d4ed8; color: #fff; }
    .btn-primary:hover { background: #2563eb; }
    .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border2); }
    .btn-ghost:hover { border-color: #555; color: var(--text); }
    .search-wrap { position: relative; }
    .search-wrap input { padding-left: 1.8rem; width: 180px; }
    .search-wrap::before { content: "⌕"; position: absolute; left: .5rem; top: 50%; transform: translateY(-50%); color: var(--dim); font-size: 1rem; pointer-events: none; }

    /* ── Stats bar ── */
    #stats-bar { background: var(--surface); border-bottom: 1px solid var(--border); padding: .5rem 1.25rem; display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: .8rem; color: var(--muted); }
    .stat-item strong { color: var(--text); }
    .src-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    .src-dot.meetup { background: var(--meetup); }
    .src-dot.eventbrite { background: var(--eventbrite); }
    .src-dot.luma { background: var(--luma); }

    /* ── Layout ── */
    main { flex: 1; padding: 1rem 1.25rem; overflow-y: auto; }
    #grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: .75rem; }

    /* ── Event card ── */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; transition: border-color .15s; }
    .card:hover { border-color: #3a3a3a; }
    .card-img { width: 100%; height: 140px; object-fit: cover; background: #1a1a1a; display: block; }
    .card-img-placeholder { width: 100%; height: 140px; background: linear-gradient(135deg, #1a1a2e, #16213e); display: flex; align-items: center; justify-content: center; font-size: 2rem; }
    .card-body { padding: .85rem; flex: 1; display: flex; flex-direction: column; gap: .4rem; }
    .card-badges { display: flex; gap: .3rem; flex-wrap: wrap; }
    .badge { font-size: .68rem; font-weight: 600; padding: .15rem .45rem; border-radius: 4px; white-space: nowrap; }
    .badge.meetup { background: rgba(246,64,96,.15); color: var(--meetup); }
    .badge.eventbrite { background: rgba(240,85,55,.15); color: var(--eventbrite); }
    .badge.luma { background: rgba(139,92,246,.15); color: var(--luma); }
    .badge.free { background: rgba(34,197,94,.15); color: var(--green); }
    .badge.online { background: rgba(56,189,248,.15); color: var(--blue); }
    .badge.city { background: #1e1e1e; color: var(--muted); border: 1px solid var(--border2); }
    .card-title { font-size: .9rem; font-weight: 600; color: #fff; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-title a { color: inherit; text-decoration: none; }
    .card-title a:hover { color: var(--blue); }
    .card-meta { font-size: .78rem; color: var(--muted); display: flex; flex-direction: column; gap: .2rem; margin-top: auto; padding-top: .4rem; }
    .card-meta-row { display: flex; align-items: center; gap: .4rem; }
    .card-meta-row svg { flex-shrink: 0; opacity: .6; }
    .rsvp-bar-wrap { margin-top: .3rem; }
    .rsvp-bar { height: 3px; background: #222; border-radius: 2px; overflow: hidden; }
    .rsvp-bar-fill { height: 100%; background: linear-gradient(90deg, #1d4ed8, #38bdf8); border-radius: 2px; }
    .rsvp-label { font-size: .7rem; color: var(--muted); margin-top: .2rem; }
    .tags { display: flex; flex-wrap: wrap; gap: .25rem; margin-top: .2rem; }
    .tag { font-size: .65rem; background: #1c1c1c; color: var(--dim); border: 1px solid #2a2a2a; padding: .1rem .35rem; border-radius: 3px; }

    /* ── Pagination ── */
    #pagination { display: flex; align-items: center; justify-content: center; gap: .5rem; padding: 1.5rem 0; }
    #pagination button { background: var(--surface); border: 1px solid var(--border2); color: var(--text); padding: .4rem .9rem; border-radius: 6px; cursor: pointer; font-size: .84rem; }
    #pagination button:hover:not(:disabled) { border-color: #555; }
    #pagination button:disabled { opacity: .3; cursor: default; }
    #page-info { font-size: .82rem; color: var(--muted); }

    /* ── Empty / loading ── */
    .placeholder { grid-column: 1/-1; text-align: center; padding: 4rem 0; color: var(--dim); }
    .spinner { width: 28px; height: 28px; border: 3px solid #222; border-top-color: #555; border-radius: 50%; animation: spin .7s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      header { gap: .5rem; }
      .search-wrap input { width: 130px; }
      #grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<header>
  <h1>City Events <span id="city-label">All cities</span></h1>
  <div class="filters">
    <div class="search-wrap">
      <input id="q" type="text" placeholder="Search…" />
    </div>
    <select id="f-city">
      <option value="">All cities</option>
      ${cityOptions}
    </select>
    <select id="f-source">
      <option value="">All sources</option>
      <option value="meetup">Meetup</option>
      <option value="eventbrite">Eventbrite</option>
      <option value="luma">Luma</option>
    </select>
    <select id="f-sort">
      <option value="startTime">Soonest first</option>
      <option value="rsvpCount">Top RSVP</option>
    </select>
    <input id="f-from" type="date" title="From date" />
    <input id="f-until" type="date" title="Until date" />
    <button class="btn btn-ghost" id="btn-reset">Reset</button>
  </div>
</header>

<div id="stats-bar">
  <span class="stat-item">Loading…</span>
</div>

<main>
  <div id="grid">
    <div class="placeholder"><div class="spinner"></div>Fetching events…</div>
  </div>
  <div id="pagination" style="display:none">
    <button id="btn-prev" disabled>← Prev</button>
    <span id="page-info"></span>
    <button id="btn-next">Next →</button>
  </div>
</main>

<script>
const API = '${base}'
const PAGE_SIZE = 24
let page = 0
let total = 0
let searchTimer = null

const $ = (id) => document.getElementById(id)
const fmtDate = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
const fmtCity = (slug) => slug ? slug.replace(/-/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()) : ''
const esc = (s) => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''

const EMOJIS = { meetup: '🟣', eventbrite: '🟠', luma: '🔵' }
const PLACEHOLDERS = ['🎭','🎸','🏃','🍕','💡','🎨','🌿','🤝','🎤','📸']

function getFilters() {
  return {
    city: $('f-city').value,
    source: $('f-source').value,
    sort: $('f-sort').value,
    from: $('f-from').value,
    until: $('f-until').value,
    q: $('q').value.trim(),
  }
}

function buildParams(f, skip) {
  const p = new URLSearchParams({ limit: PAGE_SIZE, skip })
  if (f.city) p.set('city', f.city)
  if (f.source) p.set('source', f.source)
  if (f.sort) p.set('sort', f.sort)
  if (f.from) p.set('from', new Date(f.from).toISOString())
  if (f.until) p.set('until', new Date(f.until + 'T23:59:59').toISOString())
  return p
}

function sourceColor(src) {
  return src === 'meetup' ? '#f64060' : src === 'eventbrite' ? '#f05537' : '#8b5cf6'
}

function renderCard(e) {
  const emoji = PLACEHOLDERS[Math.abs(e.sourceId.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % PLACEHOLDERS.length]
  const img = e.imageUrl
    ? \`<img class="card-img" src="\${esc(e.imageUrl)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\"card-img-placeholder\\">\${emoji}</div>'" />\`
    : \`<div class="card-img-placeholder">\${emoji}</div>\`

  const badges = [
    \`<span class="badge \${esc(e.source)}">\${esc(e.source)}</span>\`,
    \`<span class="badge city">\${fmtCity(e.city)}</span>\`,
    e.isFree ? '<span class="badge free">Free</span>' : '',
    e.isOnline ? '<span class="badge online">Online</span>' : '',
  ].filter(Boolean).join('')

  const rsvp = e.rsvpCount != null ? (() => {
    const pct = e.rsvpLimit ? Math.min(100, Math.round(e.rsvpCount / e.rsvpLimit * 100)) : null
    return \`<div class="rsvp-bar-wrap">
      \${pct != null ? \`<div class="rsvp-bar"><div class="rsvp-bar-fill" style="width:\${pct}%"></div></div>\` : ''}
      <div class="rsvp-label">\${e.rsvpCount.toLocaleString()} going\${e.rsvpLimit ? ' · ' + pct + '% full' : ''}</div>
    </div>\`
  })() : ''

  const tags = e.tags?.length
    ? \`<div class="tags">\${e.tags.slice(0,4).map(t => \`<span class="tag">\${esc(t)}</span>\`).join('')}</div>\`
    : ''

  const venue = e.venueName || e.address
    ? \`<div class="card-meta-row">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a5.5 5.5 0 0 0-5.5 5.5c0 3.6 5.5 10.5 5.5 10.5s5.5-6.9 5.5-10.5A5.5 5.5 0 0 0 8 0zm0 7.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
        \${esc(e.venueName || e.address?.split(',')[0])}
      </div>\`
    : ''

  const organizer = e.organizerName
    ? \`<div class="card-meta-row">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 14s-1 0-1-1 1-4 7-4 7 3 7 4-1 1-1 1H2z"/></svg>
        \${esc(e.organizerName)}
      </div>\`
    : ''

  return \`<div class="card">
    <a href="\${esc(e.sourceUrl)}" target="_blank" rel="noopener">\${img}</a>
    <div class="card-body">
      <div class="card-badges">\${badges}</div>
      <div class="card-title"><a href="\${esc(e.sourceUrl)}" target="_blank" rel="noopener">\${esc(e.title)}</a></div>
      \${rsvp}
      \${tags}
      <div class="card-meta">
        <div class="card-meta-row">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1H2zm13 4H1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6z"/></svg>
          \${fmtDate(e.startTime) || 'TBD'}
        </div>
        \${venue}
        \${organizer}
      </div>
    </div>
  </div>\`
}

function renderStats(events) {
  const counts = { meetup: 0, eventbrite: 0, luma: 0 }
  let free = 0, online = 0
  for (const e of events) {
    counts[e.source] = (counts[e.source] || 0) + 1
    if (e.isFree) free++
    if (e.isOnline) online++
  }
  const f = getFilters()
  const city = f.city ? \`<strong>\${fmtCity(f.city)}</strong>\` : 'All cities'
  const src = f.source ? \`<strong>\${f.source}</strong>\` : 'all sources'
  const parts = [
    \`\${city} · \${src} · <strong>\${total}</strong> events\`,
    Object.entries(counts).filter(([,v]) => v).map(([k,v]) =>
      \`<span class="src-dot \${k}"></span><strong>\${v}</strong> \${k}\`
    ).join('  '),
    free ? \`<strong>\${free}</strong> free\` : '',
    online ? \`<strong>\${online}</strong> online\` : '',
  ].filter(Boolean)
  $('stats-bar').innerHTML = parts.map(p => \`<span class="stat-item">\${p}</span>\`).join('')
}

function setLoading() {
  $('grid').innerHTML = '<div class="placeholder"><div class="spinner"></div>Fetching events…</div>'
  $('pagination').style.display = 'none'
}

// Client-side search filter on top of server results
function applySearch(events, q) {
  if (!q) return events
  const lq = q.toLowerCase()
  return events.filter(e =>
    e.title?.toLowerCase().includes(lq) ||
    e.description?.toLowerCase().includes(lq) ||
    e.organizerName?.toLowerCase().includes(lq) ||
    e.city?.includes(lq.replace(/\\s+/g,'-')) ||
    e.tags?.some(t => t.toLowerCase().includes(lq))
  )
}

async function load() {
  const f = getFilters()
  const skip = page * PAGE_SIZE
  const params = buildParams(f, skip)
  const url = \`\${API}/events?\${params}\`

  setLoading()
  try {
    const res = await fetch(url)
    const data = await res.json()
    let events = data.events || []
    total = events.length < PAGE_SIZE && page === 0 ? events.length : (page + 1) * PAGE_SIZE + (events.length < PAGE_SIZE ? 0 : 1)

    if (f.q) events = applySearch(events, f.q)

    $('city-label').textContent = f.city ? fmtCity(f.city) : 'All cities'
    renderStats(events)

    if (!events.length) {
      $('grid').innerHTML = '<div class="placeholder">No events found. Try adjusting filters.</div>'
      $('pagination').style.display = 'none'
      return
    }

    $('grid').innerHTML = events.map(renderCard).join('')

    // Pagination
    const hasPrev = page > 0
    const hasNext = data.events?.length === PAGE_SIZE
    $('btn-prev').disabled = !hasPrev
    $('btn-next').disabled = !hasNext
    $('page-info').textContent = \`Page \${page + 1}\`
    $('pagination').style.display = 'flex'
  } catch (err) {
    $('grid').innerHTML = \`<div class="placeholder">Error loading events: \${esc(String(err))}</div>\`
  }
}

// Events
['f-city','f-source','f-sort','f-from','f-until'].forEach(id => {
  $(id).addEventListener('change', () => { page = 0; load() })
})

$('q').addEventListener('input', () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page = 0; load() }, 300)
})

$('btn-reset').addEventListener('click', () => {
  $('f-city').value = ''
  $('f-source').value = ''
  $('f-sort').value = 'startTime'
  $('f-from').value = ''
  $('f-until').value = ''
  $('q').value = ''
  page = 0
  load()
})

$('btn-prev').addEventListener('click', () => { page--; load(); window.scrollTo(0,0) })
$('btn-next').addEventListener('click', () => { page++; load(); window.scrollTo(0,0) })

// Init
load()
</script>
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
