import type { DayItinerary, TransportMode } from '../types'

const TRANSPORT_GMAPS: Record<TransportMode, string> = {
  motorcycle: 'driving',
  car: 'driving',
  bicycle: 'bicycling',
  ubike: 'bicycling',
  walking: 'walking',
  transit: 'transit',
}

export function exportItineraryCSV(itinerary: DayItinerary[]): void {
  const TYPE_LABEL: Record<string, string> = {
    attraction: '景點',
    restaurant: '餐廳',
    accommodation: '住宿',
  }
  const rows: string[][] = [
    ['日期', '天數', '序號', '類型', '名稱', '地址', '抵達時間', '離開時間', '停留(分)', '交通至下站(分)'],
  ]
  itinerary.forEach((day) => {
    day.stops.forEach((stop, idx) => {
      rows.push([
        day.date ?? '',
        `第${day.dayIndex}天`,
        String(idx + 1),
        TYPE_LABEL[stop.type] ?? stop.type,
        stop.name,
        stop.location.address ?? '',
        stop.arrivalTime,
        stop.departureTime,
        String(stop.durationMinutes),
        String(stop.travelTimeToNext),
      ])
    })
  })
  const bom = '﻿'
  const csv = bom + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '行程表.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function openDayInGoogleMaps(day: DayItinerary, transportMode: TransportMode): void {
  const stops = day.stops.filter((s) => s.location.lat !== 0 || s.location.lng !== 0)
  if (stops.length < 2) return
  const capped = stops.slice(0, 10)
  const origin = `${capped[0].location.lat},${capped[0].location.lng}`
  const destination = `${capped[capped.length - 1].location.lat},${capped[capped.length - 1].location.lng}`
  const middle = capped.slice(1, -1)
  const travelmode = TRANSPORT_GMAPS[transportMode] ?? 'driving'
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode })
  if (middle.length > 0) {
    params.set('waypoints', middle.map((s) => `${s.location.lat},${s.location.lng}`).join('|'))
  }
  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer')
}
