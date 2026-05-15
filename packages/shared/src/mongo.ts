import { MongoClient, type Db, type Collection } from 'mongodb'
import type { EventDoc, FetchLogDoc } from './types.js'

let client: MongoClient | null = null

export function getMongoClient(url: string): MongoClient {
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = new MongoClient(url, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    } as any)
  }
  return client
}

export function getDb(mongoClient: MongoClient, dbName: string): Db {
  return mongoClient.db(dbName)
}

export function eventsCollection(db: Db): Collection<EventDoc> {
  return db.collection<EventDoc>('events')
}

export function fetchLogCollection(db: Db): Collection<FetchLogDoc> {
  return db.collection<FetchLogDoc>('fetch_log')
}

// Call once at DB setup time — idempotent
export async function ensureIndexes(db: Db): Promise<void> {
  const events = eventsCollection(db)
  await Promise.all([
    events.createIndex({ source: 1, sourceId: 1 }, { unique: true }),
    events.createIndex({ startTime: 1 }),
    events.createIndex({ city: 1 }),
    events.createIndex({ loc: '2dsphere' }), // geo queries
    events.createIndex({ rsvpCount: -1 }),
  ])
}
