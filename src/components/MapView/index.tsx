import { useEffect, useRef } from 'react'
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'
import type { DayItinerary, Stop } from '../../types'
import { useAppState } from '../../store'

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined

const TRAVEL_MODE_MAP: Record<string, string> = {
  motorcycle: 'DRIVING',
  car: 'DRIVING',
  bicycle: 'BICYCLING',
  ubike: 'BICYCLING',
  walking: 'WALKING',
  transit: 'TRANSIT',
}

const TYPE_COLOR: Record<string, string> = {
  attraction: '#3b82f6',
  restaurant: '#f59e0b',
  accommodation: '#6b7280',
}

function MarkersLayer({ stops }: { stops: Stop[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    const markers = stops.map((stop, i) =>
      new google.maps.Marker({
        position: { lat: stop.location.lat, lng: stop.location.lng },
        map,
        label: { text: String(i + 1), color: 'white', fontWeight: 'bold', fontSize: '12px' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: TYPE_COLOR[stop.type] ?? '#3b82f6',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
        },
        title: `${i + 1}. ${stop.name} (${stop.arrivalTime})`,
      })
    )
    return () => { markers.forEach((m) => m.setMap(null)) }
  }, [map, stops])

  return null
}

function RouteLayer({ stops, transportMode }: { stops: Stop[]; transportMode: string }) {
  const map = useMap()
  const routesLib = useMapsLibrary('routes')
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null)

  useEffect(() => {
    if (!routesLib || !map) return
    const valid = stops.filter((s) => s.location.lat !== 0 && s.location.lng !== 0)
    if (valid.length < 2) return

    const renderer = new routesLib.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 3, strokeOpacity: 0.75 },
    })
    renderer.setMap(map)
    rendererRef.current = renderer

    const service = new routesLib.DirectionsService()
    service.route(
      {
        origin: { lat: valid[0].location.lat, lng: valid[0].location.lng },
        destination: {
          lat: valid[valid.length - 1].location.lat,
          lng: valid[valid.length - 1].location.lng,
        },
        waypoints: valid.slice(1, -1).slice(0, 23).map((s) => ({
          location: { lat: s.location.lat, lng: s.location.lng },
          stopover: true,
        })),
        travelMode: (TRAVEL_MODE_MAP[transportMode] ?? 'DRIVING') as google.maps.TravelMode,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === 'OK' && result) renderer.setDirections(result)
      }
    )

    return () => {
      renderer.setMap(null)
      rendererRef.current = null
    }
  }, [routesLib, map, stops, transportMode])

  return null
}

interface Props {
  day: DayItinerary
  dayIdx: number
}

export default function MapView({ day }: Props) {
  const { trip } = useAppState()
  const transportMode = trip?.transportMode ?? 'car'

  if (!GOOGLE_KEY) {
    return (
      <div className="h-72 flex items-center justify-center bg-gray-50 text-sm text-gray-400 rounded-lg">
        需要設定 Google Maps API Key
      </div>
    )
  }

  const validStops = day.stops.filter((s) => s.location.lat !== 0 && s.location.lng !== 0)
  const center =
    validStops.length > 0
      ? {
          lat: validStops.reduce((s, p) => s + p.location.lat, 0) / validStops.length,
          lng: validStops.reduce((s, p) => s + p.location.lng, 0) / validStops.length,
        }
      : { lat: 23.6978, lng: 120.9605 }

  return (
    <APIProvider apiKey={GOOGLE_KEY}>
      <Map
        style={{ width: '100%', height: '360px' }}
        defaultCenter={center}
        defaultZoom={12}
        gestureHandling="greedy"
      >
        <MarkersLayer stops={validStops} />
        <RouteLayer stops={validStops} transportMode={transportMode} />
      </Map>
    </APIProvider>
  )
}
