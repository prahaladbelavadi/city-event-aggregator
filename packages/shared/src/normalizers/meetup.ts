import type { NormalizedEvent } from '../types.js'

// Shape returned by the recommendedEventsWithSeries GraphQL operation (response path: data.result.edges)
interface MeetupEvent {
  id: string
  title: string
  description?: string
  dateTime: string
  endTime?: string
  eventUrl: string
  imageUrl?: string
  isOnline: boolean
  venue?: {
    name?: string
    address?: string
    city?: string
    lat?: number
    lng?: number
  }
  group?: {
    name?: string
    urlname?: string
  }
  rsvps?: { totalCount?: number }
  maxRsvps?: number
  isFree?: boolean
  topics?: { edges?: { node?: { name?: string } }[] }
}

interface MeetupGqlResponse {
  data?: {
    result?: {
      edges?: { node?: MeetupEvent }[]
    }
  }
}

export function normalizeMeetup(
  raw: MeetupGqlResponse,
  citySlug: string
): NormalizedEvent[] {
  const edges = raw.data?.result?.edges ?? []

  return edges.flatMap((edge) => {
    const e = edge.node
    if (!e?.id || !e.title || !e.dateTime) return []

    const tags =
      e.topics?.edges
        ?.flatMap((t) => (t.node?.name ? [t.node.name] : []))
        ?? []

    return [
      {
        source: 'meetup',
        sourceId: e.id,
        sourceUrl: e.eventUrl,
        title: e.title,
        description: e.description ?? null,
        startTime: new Date(e.dateTime),
        endTime: e.endTime ? new Date(e.endTime) : null,
        venueName: e.venue?.name ?? null,
        address: e.venue?.address ?? null,
        city: e.venue?.city?.toLowerCase().replace(/\s+/g, '-') ?? citySlug,
        lat: e.venue?.lat ?? null,
        lng: e.venue?.lng ?? null,
        rsvpCount: e.rsvps?.totalCount ?? null,
        rsvpLimit: e.maxRsvps ?? null,
        tags,
        imageUrl: e.imageUrl ?? null,
        organizerName: e.group?.name ?? null,
        organizerUrl: e.group?.urlname
          ? `https://www.meetup.com/${e.group.urlname}`
          : null,
        isFree: e.isFree ?? null,
        isOnline: e.isOnline ?? false,
        data: e,
      } satisfies NormalizedEvent,
    ]
  })
}
