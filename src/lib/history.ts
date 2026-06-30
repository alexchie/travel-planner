import { v4 as uuidv4 } from 'uuid'
import type { TripInfo, Attraction, Restaurant, Accommodation, DayItinerary, GeoPoint, OpenHours } from '../types'

export interface StoredSession {
  id: string
  createdAt: string
  tripInfo: TripInfo
  attractions: Attraction[]
  restaurants: Restaurant[]
  accommodations: Accommodation[]
  itinerary: DayItinerary[]
  totalDays: number
  totalStops: number
}

export interface PlaceHistory {
  id: string
  name: string
  location: GeoPoint
  openHours: OpenHours
  placeType: 'attraction' | 'restaurant'
  useCount: number
  lastUsedAt: string
}

const SESSIONS_KEY = 'tp_sessions'
const PLACES_KEY = 'tp_places'
const MAX_SESSIONS = 30
const MAX_PLACES = 300

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveSession(
  data: Omit<StoredSession, 'id' | 'createdAt'>
): string {
  const id = uuidv4()
  const entry: StoredSession = { ...data, id, createdAt: new Date().toISOString() }
  const list = readJSON<StoredSession[]>(SESSIONS_KEY, [])
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([entry, ...list].slice(0, MAX_SESSIONS)))
  return id
}

export function listSessions(): Pick<StoredSession, 'id' | 'createdAt' | 'tripInfo' | 'totalDays' | 'totalStops'>[] {
  return readJSON<StoredSession[]>(SESSIONS_KEY, []).map(
    ({ id, createdAt, tripInfo, totalDays, totalStops }) => ({ id, createdAt, tripInfo, totalDays, totalStops })
  )
}

export function loadSession(id: string): StoredSession | null {
  return readJSON<StoredSession[]>(SESSIONS_KEY, []).find(s => s.id === id) ?? null
}

export function deleteSession(id: string): void {
  const list = readJSON<StoredSession[]>(SESSIONS_KEY, []).filter(s => s.id !== id)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
}

export function savePlaces(places: PlaceHistory[]): void {
  const map = new Map(readJSON<PlaceHistory[]>(PLACES_KEY, []).map(p => [p.name.trim().toLowerCase(), p]))
  for (const p of places) {
    const key = p.name.trim().toLowerCase()
    const ex = map.get(key)
    map.set(key, { ...p, useCount: (ex?.useCount ?? 0) + 1, lastUsedAt: new Date().toISOString() })
  }
  const sorted = [...map.values()].sort((a, b) => b.useCount - a.useCount).slice(0, MAX_PLACES)
  localStorage.setItem(PLACES_KEY, JSON.stringify(sorted))
}

export function listPlaceHistory(placeType?: 'attraction' | 'restaurant'): PlaceHistory[] {
  const all = readJSON<PlaceHistory[]>(PLACES_KEY, [])
  return placeType ? all.filter(p => p.placeType === placeType) : all
}

export function searchPlaceHistory(query: string): PlaceHistory[] {
  if (!query.trim()) return []
  const q = query.trim().toLowerCase()
  return readJSON<PlaceHistory[]>(PLACES_KEY, [])
    .filter(p => p.name.toLowerCase().includes(q) || p.location.address.toLowerCase().includes(q))
    .slice(0, 5)
}
