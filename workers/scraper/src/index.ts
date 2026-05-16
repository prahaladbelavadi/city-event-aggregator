import {
  CITIES,
  normalizeMeetup,
  normalizeEventbrite,
  normalizeLuma,
  getMongoClient,
  getDb,
  eventsCollection,
  fetchLogCollection,
  type NormalizedEvent,
  type EventSource,
} from '@repo/shared'

interface Env {
  MONGODB_URL: string
  MONGODB_DB: string
  EVENTBRITE_GUEST_COOKIE: string
}

// ─── Source fetchers ──────────────────────────────────────────────────────────

async function fetchMeetup(city: (typeof CITIES)[number]) {
  const now = new Date().toISOString().replace('Z', '-04:00[US/Eastern]')
  const res = await fetch('https://www.meetup.com/gql2', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apollographql-client-name': 'nextjs-web',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15',
    },
    body: JSON.stringify({
      operationName: 'recommendedEventsWithSeries',
      variables: {
        first: 50,
        lat: city.lat,
        lon: city.lon,
        startDateRange: now,
        numberOfEventsForSeries: 5,
        seriesStartDate: now.slice(0, 10),
        sortField: 'RELEVANCE',
        doConsolidateEvents: true,
        doPromotePaypalEvents: false,
        indexAlias: '"{\"filterOutWrongLanguage\": \"true\",\"modelVersion\": \"split_offline_online\"}"',
        dataConfiguration: '{"isSimplifiedSearchEnabled": true, "include_events_from_user_chapters": true}',
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: '3f7480361301be1b3208df0cd724930a22f7741d3c24666ab5b37a381ff4e0e8',
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`Meetup ${res.status}`)
  return normalizeMeetup(await res.json(), city.slug)
}

async function fetchEventbrite(city: (typeof CITIES)[number], guestCookie: string) {
  const res = await fetch('https://www.eventbrite.com/home/api/search/', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      origin: 'https://www.eventbrite.com',
      referer: 'https://www.eventbrite.com/',
      'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
      cookie: `guest=${guestCookie}`,
    },
    body: JSON.stringify({ placeId: city.eventbritePlaceId, tab: 'all' }),
  })
  if (!res.ok) throw new Error(`Eventbrite ${res.status}`)
  return normalizeEventbrite(await res.json(), city.slug)
}

async function fetchLuma(city: (typeof CITIES)[number]) {
  if (!city.lumaPlaceId) return []
  const res = await fetch(
    `https://api2.luma.com/discover/bootstrap-page?featured_place_api_id=${city.lumaPlaceId}`,
    {
      headers: {
        accept: '*/*',
        'accept-language': 'en',
        'x-luma-client-type': 'luma-web',
        'x-luma-timezone': city.timezone,
        'x-luma-web-url': 'https://luma.com/discover',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36',
        origin: 'https://luma.com',
      },
    }
  )
  if (!res.ok) throw new Error(`Luma ${res.status}`)
  return normalizeLuma(await res.json(), city.slug)
}

// ─── DB write ─────────────────────────────────────────────────────────────────

async function upsert(
  col: ReturnType<typeof eventsCollection>,
  events: NormalizedEvent[]
): Promise<number> {
  if (events.length === 0) return 0
  const now = new Date()
  const ops = events.map((e) => ({
    updateOne: {
      filter: { source: e.source, sourceId: e.sourceId },
      update: {
        $set: {
          ...e,
          loc: e.lat !== null && e.lng !== null
            ? { type: 'Point' as const, coordinates: [e.lng, e.lat] as [number, number] }
            : null,
          gcalEventId: null,
          fetchedAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      upsert: true,
    },
  }))
  const result = await col.bulkWrite(ops, { ordered: false })
  return result.upsertedCount + result.modifiedCount
}

// ─── Cron handler ─────────────────────────────────────────────────────────────

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const mongo = getMongoClient(env.MONGODB_URL)
    await mongo.connect()
    const db = getDb(mongo, env.MONGODB_DB)
    const col = eventsCollection(db)
    const log = fetchLogCollection(db)

    // All cities in parallel — each city fans out to 3 sources in parallel
    await Promise.allSettled(
      CITIES.map(async (city) => {
        const sources: EventSource[] = ['meetup', 'eventbrite', 'luma']
        const start = Date.now()

        const results = await Promise.allSettled([
          fetchMeetup(city),
          fetchEventbrite(city, env.EVENTBRITE_GUEST_COOKIE),
          fetchLuma(city),
        ])

        // Collect all log entries and write them in one bulkWrite
        const logDocs = await Promise.all(
          results.map(async (result, i) => {
            const source = sources[i]!
            if (result.status === 'rejected') {
              console.error(`${source}/${city.slug}:`, result.reason)
              return {
                source,
                citySlug: city.slug,
                fetchedAt: new Date(),
                eventsFound: 0,
                eventsUpserted: 0,
                durationMs: Date.now() - start,
                error: String(result.reason),
              }
            }
            const upserted = await upsert(col, result.value)
            console.log(`${source}/${city.slug}: ${result.value.length} found, ${upserted} upserted`)
            return {
              source,
              citySlug: city.slug,
              fetchedAt: new Date(),
              eventsFound: result.value.length,
              eventsUpserted: upserted,
              durationMs: Date.now() - start,
              error: null,
            }
          })
        )

        await log.insertMany(logDocs)
      })
    )
  },
} satisfies ExportedHandler<Env>
