import type { NormalizedEvent } from '../types.js'

// Shape of each item inside featured_place.events
interface LumaEventEntry {
  api_id: string
  start_at?: string
  guest_count?: number
  cover_image?: { url?: string }
  calendar?: { name?: string; url?: string }
  event?: {
    api_id?: string
    name?: string
    description?: string
    start_at?: string
    end_at?: string
    url?: string           // slug only, e.g. "j06tn4rw"
    cover_url?: string
    timezone?: string
    location_type?: string // "offline" | "online"
    geo_address_info?: {
      full_address?: string
      city?: string
      latitude?: number
      longitude?: number
      mode?: string
    }
    ticket_info?: { is_free?: boolean }
    capacity?: number
    tags?: string[]
    event_type?: string
  }
}

interface LumaBootstrapResponse {
  featured_place?: {
    events?: LumaEventEntry[]
  }
}

export function normalizeLuma(
  raw: LumaBootstrapResponse,
  citySlug: string
): NormalizedEvent[] {
  const entries = raw.featured_place?.events ?? []
  const seen = new Set<string>()

  return entries.flatMap((entry) => {
    const e = entry.event
    const id = e?.api_id ?? entry.api_id
    if (!id || !e?.name || !e.start_at) return []
    if (seen.has(id)) return []
    seen.add(id)

    const lat = e.geo_address_info?.latitude ?? null
    const lng = e.geo_address_info?.longitude ?? null

    const imageUrl =
      entry.cover_image?.url ?? e.cover_url ?? null

    const slug = e.url
    const sourceUrl = slug ? `https://lu.ma/${slug}` : `https://lu.ma/${id}`

    return [
      {
        source: 'luma',
        sourceId: id,
        sourceUrl,
        title: e.name,
        description: e.description ?? null,
        startTime: new Date(e.start_at),
        endTime: e.end_at ? new Date(e.end_at) : null,
        venueName: null,
        address: e.geo_address_info?.full_address ?? null,
        city:
          e.geo_address_info?.city
            ?.toLowerCase()
            .replace(/\s+/g, '-') ?? citySlug,
        lat,
        lng,
        rsvpCount: entry.guest_count ?? null,
        rsvpLimit: e.capacity ?? null,
        tags: e.tags ?? [],
        imageUrl,
        organizerName: entry.calendar?.name ?? null,
        organizerUrl: entry.calendar?.url
          ? `https://lu.ma/${entry.calendar.url}`
          : null,
        isFree: e.ticket_info?.is_free ?? null,
        isOnline: e.location_type === 'online' || e.event_type === 'online',
        data: entry,
      } satisfies NormalizedEvent,
    ]
  })
}
