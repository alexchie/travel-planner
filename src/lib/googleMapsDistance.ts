import type { GeoPoint } from '../types'

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined

const TRAVEL_MODE: Record<string, string> = {
  motorcycle: 'DRIVE',
  car: 'DRIVE',
  bicycle: 'BICYCLE',
  ubike: 'BICYCLE',
  walking: 'WALK',
  transit: 'TRANSIT',
}

interface MatrixElement {
  originIndex: number
  destinationIndex: number
  duration?: string
  status?: { code?: number }
}

export async function computeTravelMatrix(
  points: GeoPoint[],
  mode: string
): Promise<number[][] | null> {
  if (!GOOGLE_KEY || points.length < 2) return null

  const waypoints = points.map((p) => ({
    waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
  }))

  const res = await fetch(
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,status',
      },
      body: JSON.stringify({
        origins: waypoints,
        destinations: waypoints,
        travelMode: TRAVEL_MODE[mode] ?? 'DRIVE',
      }),
    }
  )

  if (!res.ok) throw new Error(`Routes API ${res.status}`)

  const data: MatrixElement[] = await res.json()
  if (!Array.isArray(data)) throw new Error('Routes API 回應格式錯誤')

  const n = points.length
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(60))
  for (const el of data) {
    const i = el.originIndex
    const j = el.destinationIndex
    if (i === j) { matrix[i][j] = 0; continue }
    if (el.duration) {
      matrix[i][j] = Math.ceil(parseFloat(el.duration.replace('s', '')) / 60)
    }
  }
  return matrix
}
