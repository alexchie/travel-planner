import type { Attraction, Restaurant, TransportMode, Conflict } from '../types'
import { travelMinutes } from './distance'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function intervalsOverlap(
  s1: number, e1: number, s2: number, e2: number
): boolean {
  return s1 < e2 && s2 < e1
}

export function detectConflicts(
  attractions: Attraction[],
  restaurants: Restaurant[],
  mode: TransportMode
): Conflict[] {
  const conflicts: Conflict[] = []

  const mustAttractions = attractions.filter(
    (a) => a.priority === 'must' && a.timeWindowRequired
  )
  const mustRestaurants = restaurants.filter(
    (r) => r.priority === 'must' && r.mealAssignmentMode === 'fixed_day' && r.assignedDay !== null
  )

  // Check time-window overlaps between must attractions
  for (let i = 0; i < mustAttractions.length; i++) {
    for (let j = i + 1; j < mustAttractions.length; j++) {
      const a = mustAttractions[i]
      const b = mustAttractions[j]
      if (!a.timeWindowRequired || !b.timeWindowRequired) continue
      if (a.timeWindowRequired.date !== b.timeWindowRequired.date) continue

      const aStart = timeToMinutes(a.timeWindowRequired.startTime)
      const aEnd = timeToMinutes(a.timeWindowRequired.endTime)
      const bStart = timeToMinutes(b.timeWindowRequired.startTime)
      const bEnd = timeToMinutes(b.timeWindowRequired.endTime)

      if (intervalsOverlap(aStart, aEnd, bStart, bEnd)) {
        // Check if distance between them is feasible
        const travel = travelMinutes(a.location, b.location, mode)
        const gap = Math.max(aEnd, bEnd) - Math.min(aStart, bStart) - (aEnd - aStart) - (bEnd - bStart)
        if (gap < travel) {
          conflicts.push({
            type: 'time_overlap',
            itemA: a.name,
            itemB: b.name,
            message: `「${a.name}」要求 ${a.timeWindowRequired.startTime}–${a.timeWindowRequired.endTime}，「${b.name}」要求 ${b.timeWindowRequired.startTime}–${b.timeWindowRequired.endTime}，時段重疊且交通時間不足（需 ${travel} 分鐘）`,
          })
        }
      }

      // Check geographic feasibility even without overlap
      const travel = travelMinutes(a.location, b.location, mode)
      const gapBetween = Math.abs(bStart - aEnd)
      if (!intervalsOverlap(aStart, aEnd, bStart, bEnd) && gapBetween < travel) {
        conflicts.push({
          type: 'distance_infeasible',
          itemA: a.name,
          itemB: b.name,
          message: `「${a.name}」結束後到「${b.name}」需 ${travel} 分鐘，但兩者時段間隔僅 ${gapBetween} 分鐘`,
        })
      }
    }
  }

  void mustRestaurants
  return conflicts
}
