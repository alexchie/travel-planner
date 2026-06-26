import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { DayItinerary } from '../../types'

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function createNumberedIcon(n: number, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] })
    }
  }, [map, positions])
  return null
}

interface Props {
  day: DayItinerary
  dayIdx: number
}

export default function MapView({ day, dayIdx }: Props) {
  const color = COLORS[dayIdx % COLORS.length]
  const validStops = day.stops.filter(
    (s) => s.location.lat !== 0 && s.location.lng !== 0
  )
  const positions: [number, number][] = validStops.map((s) => [s.location.lat, s.location.lng])

  const center: [number, number] =
    positions.length > 0
      ? [
          positions.reduce((s, p) => s + p[0], 0) / positions.length,
          positions.reduce((s, p) => s + p[1], 0) / positions.length,
        ]
      : [23.6978, 120.9605]

  return (
    <MapContainer center={center} zoom={12} style={{ height: '320px', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positions.length > 1 && (
        <Polyline positions={positions} color={color} weight={3} opacity={0.8} />
      )}
      {validStops.map((stop, i) => (
        <Marker
          key={stop.id}
          position={[stop.location.lat, stop.location.lng]}
          icon={createNumberedIcon(i + 1, stop.type === 'accommodation' ? '#6b7280' : color)}
        >
          <Popup>
            <div className="text-sm">
              <strong>{stop.name}</strong>
              <br />
              {stop.arrivalTime} – {stop.departureTime}
              {stop.hasWarning && (
                <div className="text-orange-500 mt-1 text-xs">{stop.warningMessage}</div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
      <FitBounds positions={positions} />
    </MapContainer>
  )
}
