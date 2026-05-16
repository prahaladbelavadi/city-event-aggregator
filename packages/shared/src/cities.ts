export interface CityConfig {
  slug: string
  name: string
  state: string
  lat: number
  lon: number
  radiusKm: number
  timezone: string
  // Eventbrite: Who's on First place ID for POST /home/api/search/
  eventbritePlaceId: string
  // Luma: discplace-* ID. Find by visiting luma.com/discover,
  // selecting your city, and checking the bootstrap-page network request.
  lumaPlaceId: string | null
}

export const CITIES: CityConfig[] = [
  {
    slug: 'seattle',
    name: 'Seattle',
    state: 'wa',
    lat: 47.6062,
    lon: -122.3321,
    radiusKm: 50,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '101730401',
    lumaPlaceId: 'discplace-FQ4E58PeBMHGTKK',
  },
  {
    slug: 'everett',
    name: 'Everett',
    state: 'wa',
    lat: 47.9790,
    lon: -122.2021,
    radiusKm: 30,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '101729883',
    lumaPlaceId: null,
  },
  {
    slug: 'bellevue',
    name: 'Bellevue',
    state: 'wa',
    lat: 47.6101,
    lon: -122.2015,
    radiusKm: 30,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '101730405',
    lumaPlaceId: null,
  },
  {
    slug: 'san-francisco',
    name: 'San Francisco',
    state: 'ca',
    lat: 37.7749,
    lon: -122.4194,
    radiusKm: 40,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '85922583',
    lumaPlaceId: null,
  },
  {
    slug: 'palo-alto',
    name: 'Palo Alto',
    state: 'ca',
    lat: 37.4419,
    lon: -122.143,
    radiusKm: 30,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '85921881',
    lumaPlaceId: null,
  },
  {
    slug: 'irvine',
    name: 'Irvine',
    state: 'ca',
    lat: 33.74,
    lon: -117.75,
    radiusKm: 30,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '85921779',
    lumaPlaceId: null,
  },
  {
    slug: 'los-angeles',
    name: 'Los Angeles',
    state: 'ca',
    lat: 34.0522,
    lon: -118.2437,
    radiusKm: 50,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '85923517',
    lumaPlaceId: null,
  },
  {
    slug: 'orange-county',
    name: 'Orange County',
    state: 'ca',
    lat: 33.7175,
    lon: -117.8311,
    radiusKm: 40,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '102086957',
    lumaPlaceId: null,
  },
  {
    slug: 'portland',
    name: 'Portland',
    state: 'or',
    lat: 45.5051,
    lon: -122.675,
    radiusKm: 40,
    timezone: 'America/Los_Angeles',
    eventbritePlaceId: '101715829',
    lumaPlaceId: null,
  },
  {
    slug: 'new-york',
    name: 'New York',
    state: 'ny',
    lat: 40.7128,
    lon: -74.006,
    radiusKm: 50,
    timezone: 'America/New_York',
    eventbritePlaceId: '85977539',
    lumaPlaceId: null,
  },
  {
    slug: 'miami',
    name: 'Miami',
    state: 'fl',
    lat: 25.7617,
    lon: -80.1918,
    radiusKm: 40,
    timezone: 'America/New_York',
    eventbritePlaceId: '85933029',
    lumaPlaceId: null,
  },
]

export function getCityBySlug(slug: string): CityConfig | undefined {
  return CITIES.find((c) => c.slug === slug)
}
