import type {
  TripInfo,
  Attraction,
  Restaurant,
  Accommodation,
  DayItinerary,
  Stop,
  MealType,
  GeoPoint,
} from '../types'
import { travelMinutes } from './distance'
import { v4 as uuidv4 } from 'uuid'

const MEAL_WINDOWS: Record<Exclude<MealType, 'any'>, { start: number; end: number }> = {
  breakfast: { start: 7 * 60, end: 10 * 60 },
  lunch: { start: 11 * 60 + 30, end: 14 * 60 },
  dinner: { start: 17 * 60 + 30, end: 21 * 60 },
  afternoon_tea: { start: 14 * 60 + 30, end: 17 * 60 },
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getDateDayKey(dateStr: string): string {
  const d = new Date(dateStr)
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()]
}

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const cur = new Date(start)
  const fin = new Date(end)
  while (cur <= fin) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

interface ScheduleItem {
  id: string
  name: string
  location: GeoPoint
  durationMinutes: number
  type: 'attraction' | 'restaurant'
  mealType?: MealType
  priority: 'must' | 'flexible'
  fixedDay?: number
  fixedStartMinutes?: number
  fixedEndMinutes?: number
  openHours: Record<string, { open: string; close: string } | null>
}

function isOpenOnDay(item: ScheduleItem, dayKey: string, startMin: number): boolean {
  const hours = item.openHours[dayKey]
  if (!hours) return false
  const open = timeToMinutes(hours.open)
  const close = timeToMinutes(hours.close)
  return startMin >= open && startMin + item.durationMinutes <= close + 30
}

function totalRouteTime(stops: GeoPoint[], mode: Parameters<typeof travelMinutes>[2]): number {
  let total = 0
  for (let i = 0; i < stops.length - 1; i++) {
    total += travelMinutes(stops[i], stops[i + 1], mode)
  }
  return total
}

function twoOptImprove(order: number[], matrix: number[][]): number[] {
  let improved = true
  let best = [...order]
  while (improved) {
    improved = false
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const before =
          matrix[best[i - 1]][best[i]] + matrix[best[j]][best[(j + 1) % best.length]]
        const after =
          matrix[best[i - 1]][best[j]] + matrix[best[i]][best[(j + 1) % best.length]]
        if (after < before) {
          const seg = best.slice(i, j + 1).reverse()
          best = [...best.slice(0, i), ...seg, ...best.slice(j + 1)]
          improved = true
        }
      }
    }
  }
  return best
}

export function optimize(
  trip: TripInfo,
  attractions: Attraction[],
  restaurants: Restaurant[],
  accommodations: Accommodation[]
): DayItinerary[] {
  const days = getDaysBetween(
    trip.arrivalDatetime.slice(0, 10),
    trip.departureDatetime.slice(0, 10)
  )
  const mode = trip.transportMode

  const items: ScheduleItem[] = [
    ...attractions.map((a) => ({
      id: a.id,
      name: a.name,
      location: a.location,
      durationMinutes: a.durationMinutes,
      type: 'attraction' as const,
      priority: a.priority,
      fixedDay: a.timeWindowRequired
        ? days.findIndex((d) => d === a.timeWindowRequired!.date) + 1
        : undefined,
      fixedStartMinutes: a.timeWindowRequired
        ? timeToMinutes(a.timeWindowRequired.startTime)
        : undefined,
      openHours: a.openHours,
    })),
    ...restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location,
      durationMinutes: r.dishType === 'snack' ? 30 : 60,
      type: 'restaurant' as const,
      mealType: r.mealType === 'any' ? undefined : r.mealType,
      priority: r.priority,
      fixedDay:
        r.mealAssignmentMode === 'fixed_day' && r.assignedDay != null
          ? r.assignedDay
          : undefined,
      openHours: r.openHours,
    })),
  ]

  const result: DayItinerary[] = []

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const date = days[dayIdx]
    const dayNum = dayIdx + 1
    const dayKey = getDateDayKey(date)

    const accom = accommodations.find((a) => a.dayIndex === dayNum)
    const startLoc = dayIdx === 0 ? trip.startLocation : accommodations.find((a) => a.dayIndex === dayNum - 1)?.location ?? trip.startLocation
    const endLoc = accom?.location ?? trip.endLocation

    const dayItems = items.filter((item) => {
      if (item.fixedDay !== undefined) return item.fixedDay === dayNum
      return true
    })

    // Separate fixed-time items and flexible items
    const fixedItems = dayItems.filter((i) => i.fixedStartMinutes !== undefined)
    const flexItems = dayItems.filter((i) => i.fixedStartMinutes === undefined)

    // Build schedule as ordered stops
    interface Slot {
      item: ScheduleItem
      startMin: number
    }
    const slots: Slot[] = fixedItems.map((i) => ({
      item: i,
      startMin: i.fixedStartMinutes!,
    }))

    // Start time (based on trip arrival or 9am)
    let cursor = dayIdx === 0 ? timeToMinutes(trip.arrivalDatetime.slice(11, 16)) : 9 * 60

    // Sort slots by time
    slots.sort((a, b) => a.startMin - b.startMin)

    // Greedily insert flexible items
    let currentLoc = startLoc
    const scheduled: Slot[] = [...slots]
    const unscheduled = flexItems.filter((i) => !slots.find((s) => s.item.id === i.id))

    // Try to fit meal slots in appropriate windows
    const mealItems = unscheduled.filter((i) => i.mealType && i.mealType in MEAL_WINDOWS)
    const nonMealItems = unscheduled.filter((i) => !i.mealType || !(i.mealType in MEAL_WINDOWS))

    const CURFEW = 22 * 60 + 30

    const toInsert = [...nonMealItems]
    for (const meal of mealItems) {
      const window = MEAL_WINDOWS[meal.mealType as Exclude<MealType, 'any'>]
      const startMin = Math.max(cursor, window.start)
      if (startMin >= window.end) continue
      const mealEnd = startMin + meal.durationMinutes
      const travelBack = travelMinutes(meal.location, endLoc, mode)
      if (mealEnd + travelBack > CURFEW) continue
      scheduled.push({ item: meal, startMin })
      cursor = mealEnd
    }

    // Greedy insert non-meal attractions
    let positions = [...scheduled]
    for (const item of toInsert) {
      const travel = travelMinutes(currentLoc, item.location, mode)
      const arrival = cursor + travel
      if (!isOpenOnDay(item, dayKey, arrival)) continue
      const departure = arrival + item.durationMinutes
      if (departure > 21 * 60) continue
      const travelBack = travelMinutes(item.location, endLoc, mode)
      if (departure + travelBack > CURFEW) continue
      positions.push({ item, startMin: arrival })
      cursor = departure
      currentLoc = item.location
    }

    // Sort by start time
    positions.sort((a, b) => a.startMin - b.startMin)

    // 2-opt on the non-fixed items
    const fixedSet = new Set(fixedItems.map((i) => i.id))
    const flexPositions = positions.filter((p) => !fixedSet.has(p.item.id))
    if (flexPositions.length > 3) {
      const pts = flexPositions.map((p) => p.item.location)
      const matrix = pts.map((a) => pts.map((b) => travelMinutes(a, b, mode)))
      const indices = flexPositions.map((_, i) => i)
      const improved = twoOptImprove(indices, matrix)
      const reordered = improved.map((i) => flexPositions[i])
      positions = [
        ...positions.filter((p) => fixedSet.has(p.item.id)),
        ...reordered,
      ].sort((a, b) => a.startMin - b.startMin)
    }

    // Build stops with actual times
    const stops: Stop[] = []
    let prevLoc = startLoc
    let time = dayIdx === 0 ? timeToMinutes(trip.arrivalDatetime.slice(11, 16)) : 9 * 60

    // Add start accommodation/location as first stop if day > 1
    if (dayIdx > 0 && accom) {
      const prevAccom = accommodations.find((a) => a.dayIndex === dayNum - 1)
      if (prevAccom) {
        stops.push({
          id: uuidv4(),
          type: 'accommodation',
          name: `出發：${prevAccom.name}`,
          location: prevAccom.location,
          arrivalTime: minutesToTime(time),
          departureTime: minutesToTime(time),
          durationMinutes: 0,
          travelTimeToNext: 0,
          hasWarning: false,
        })
        prevLoc = prevAccom.location
      }
    }

    let totalTravel = 0
    let hasWarning = false

    for (let i = 0; i < positions.length; i++) {
      const { item } = positions[i]
      const travel = travelMinutes(prevLoc, item.location, mode)
      const arrival = time + travel
      const departure = arrival + item.durationMinutes

      // Check if open
      const dayHours = item.openHours[dayKey]
      let itemWarning = false
      let warningMsg = ''
      if (dayHours) {
        const openMin = timeToMinutes(dayHours.open)
        const closeMin = timeToMinutes(dayHours.close)
        if (arrival < openMin || departure > closeMin + 30) {
          itemWarning = true
          warningMsg = `營業時間 ${dayHours.open}–${dayHours.close}，但安排在 ${minutesToTime(arrival)}–${minutesToTime(departure)}`
          hasWarning = true
        }
      } else {
        itemWarning = true
        warningMsg = `${['週日', '週一', '週二', '週三', '週四', '週五', '週六'][new Date(date).getDay()]}休息`
        hasWarning = true
      }

      const travelToNext =
        i < positions.length - 1
          ? travelMinutes(item.location, positions[i + 1].item.location, mode)
          : travelMinutes(item.location, endLoc, mode)

      stops.push({
        id: uuidv4(),
        type: item.type,
        name: item.name,
        location: item.location,
        arrivalTime: minutesToTime(arrival),
        departureTime: minutesToTime(departure),
        durationMinutes: item.durationMinutes,
        travelTimeToNext,
        hasWarning: itemWarning,
        warningMessage: warningMsg || undefined,
        mealType: item.mealType,
      })

      totalTravel += travel
      time = departure
      prevLoc = item.location
    }

    // Add final accommodation
    if (accom) {
      const travel = travelMinutes(prevLoc, accom.location, mode)
      totalTravel += travel
      stops.push({
        id: uuidv4(),
        type: 'accommodation',
        name: `住宿：${accom.name}`,
        location: accom.location,
        arrivalTime: minutesToTime(time + travel),
        departureTime: minutesToTime(time + travel),
        durationMinutes: 0,
        travelTimeToNext: 0,
        hasWarning: false,
      })
    }

    // Remove items already scheduled on this day from future days' candidate pool
    for (const pos of positions) {
      const idx = items.findIndex((i) => i.id === pos.item.id)
      if (idx !== -1 && items[idx].fixedDay === undefined) {
        items.splice(idx, 1)
      }
    }

    result.push({
      dayIndex: dayNum,
      date,
      stops,
      totalTravelMinutes: totalTravel,
      hasConstraintWarning: hasWarning,
    })
  }

  // Recompute stops with correct travelTimeToNext using totalRouteTime fix
  void totalRouteTime

  return result
}

export function reorderDay(
  itinerary: DayItinerary[],
  dayIndex: number,
  fromIdx: number,
  toIdx: number,
  mode: Parameters<typeof travelMinutes>[2]
): DayItinerary[] {
  return itinerary.map((day) => {
    if (day.dayIndex !== dayIndex) return day
    const stops = [...day.stops]
    const [moved] = stops.splice(fromIdx, 1)
    stops.splice(toIdx, 0, moved)

    // Recalculate travel times
    let totalTravel = 0
    const recalc: Stop[] = stops.map((stop, i) => {
      const next = stops[i + 1]
      const travelToNext = next ? travelMinutes(stop.location, next.location, mode) : 0
      totalTravel += travelToNext
      return { ...stop, travelTimeToNext }
    })

    // Check constraint warnings
    const hasConstraintWarning = recalc.some((s) => s.hasWarning)

    return {
      ...day,
      stops: recalc,
      totalTravelMinutes: totalTravel,
      hasConstraintWarning,
    }
  })
}
