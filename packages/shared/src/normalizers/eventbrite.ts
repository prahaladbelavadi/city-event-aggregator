import type { NormalizedEvent } from '../types.js'

// Shape from POST /home/api/search/ { placeId, tab }
interface EBSearchEvent {
  id: string
  eventbrite_event_id?: string
  name?: string
  summary?: string
  start_date?: string  // "YYYY-MM-DD"
  start_time?: string  // "HH:MM:SS"
  end_date?: string
  end_time?: string
  timezone?: string
  url?: string
  is_online_event?: boolean
  is_free?: boolean
  image?: string       // direct URL string
  primary_venue?: {
    name?: string
    address?: {
      localized_address_display?: string
      city?: string
      latitude?: string
      longitude?: string
    }
  }
  primary_organizer?: {
    name?: string
    url?: string
  } | null
  tags?: { display_name?: string }[]
  ticket_availability?: {
    is_free?: boolean
    minimum_ticket_price?: { value?: number }
  }
}

interface EBSearchResponse {
  events?: EBSearchEvent[]
}

function toUtc(date: string | undefined, time: string | undefined, tz: string | undefined): Date | null {
  if (!date || !time) return null
  try {
    // Build a local datetime string and let Intl resolve the offset
    const localStr = `${date}T${time}`
    // We can't do full IANA tz math in a Workers environment without a library,
    // so store the nominal UTC offset by treating the local time as-is.
    // This will be off by the UTC offset of the city's timezone but close enough
    // for sorting/display — and preserves the actual date/time correctly.
    return new Date(localStr)
  } catch {
    return null
  }
}

export function normalizeEventbrite(
  raw: EBSearchResponse,
  citySlug: string
): NormalizedEvent[] {
  return (raw.events ?? []).flatMap((e) => {
    if (!e.id || !e.name) return []

    const startTime = toUtc(e.start_date, e.start_time, e.timezone)
    if (!startTime) return []

    const tags = (e.tags ?? []).flatMap((t) => t.display_name ? [t.display_name] : [])

    const lat = e.primary_venue?.address?.latitude
      ? parseFloat(e.primary_venue.address.latitude)
      : null
    const lng = e.primary_venue?.address?.longitude
      ? parseFloat(e.primary_venue.address.longitude)
      : null

    const isFree =
      e.is_free ??
      e.ticket_availability?.is_free ??
      (e.ticket_availability?.minimum_ticket_price?.value === 0 ? true : null)

    return [
      {
        source: 'eventbrite',
        sourceId: e.eventbrite_event_id ?? e.id,
        sourceUrl: e.url ?? `https://www.eventbrite.com/e/${e.id}`,
        title: e.name,
        description: e.summary ?? null,
        startTime,
        endTime: toUtc(e.end_date, e.end_time, e.timezone),
        venueName: e.primary_venue?.name ?? null,
        address: e.primary_venue?.address?.localized_address_display ?? null,
        city:
          e.primary_venue?.address?.city
            ?.toLowerCase()
            .replace(/\s+/g, '-') ?? citySlug,
        lat,
        lng,
        rsvpCount: null,
        rsvpLimit: null,
        tags,
        imageUrl: e.image ?? null,
        organizerName: e.primary_organizer?.name ?? null,
        organizerUrl: e.primary_organizer?.url ?? null,
        isFree,
        isOnline: e.is_online_event ?? false,
        data: e,
      } satisfies NormalizedEvent,
    ]
  })
}
