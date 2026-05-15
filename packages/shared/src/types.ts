import type { ObjectId } from 'mongodb'

export type EventSource = 'meetup' | 'eventbrite' | 'luma'

// Canonical normalized shape — what every source normalizer must produce
export interface NormalizedEvent {
  source: EventSource
  sourceId: string
  sourceUrl: string
  title: string
  description: string | null
  startTime: Date
  endTime: Date | null
  venueName: string | null
  address: string | null
  city: string          // city slug e.g. "seattle"
  lat: number | null
  lng: number | null
  rsvpCount: number | null
  rsvpLimit: number | null
  tags: string[]
  imageUrl: string | null
  organizerName: string | null
  organizerUrl: string | null
  isFree: boolean | null
  isOnline: boolean
  data: unknown         // full raw payload, never truncated
}

// MongoDB document shape — NormalizedEvent + DB bookkeeping fields
export interface EventDoc extends NormalizedEvent {
  _id?: ObjectId
  // GeoJSON point for $near queries
  loc: { type: 'Point'; coordinates: [number, number] } | null
  gcalEventId: string | null
  fetchedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface FetchLogDoc {
  _id?: ObjectId
  source: EventSource
  citySlug: string
  fetchedAt: Date
  eventsFound: number
  eventsUpserted: number
  durationMs: number
  error: string | null
}
