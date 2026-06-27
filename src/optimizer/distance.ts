import type { GeoPoint, TransportMode } from '../types'

const SPEED_KMH: Record<TransportMode, number> = {
  motorcycle: 50,
  car: 40,
  bicycle: 15,
  ubike: 12,
  walking: 5,
  transit: 25,
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function travelMinutes(a: GeoPoint, b: GeoPoint, mode: TransportMode): number {
  const dist = haversineKm(a, b)
  return Math.round((dist / SPEED_KMH[mode]) * 60)
}

export function buildDistanceMatrix(
  points: GeoPoint[],
  mode: TransportMode
): number[][] {
  return points.map((a) => points.map((b) => travelMinutes(a, b, mode)))
}
