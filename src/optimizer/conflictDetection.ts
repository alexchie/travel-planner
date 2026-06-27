import type { Attraction, Restaurant, TransportMode, Conflict } from '../types'
import { travelMinutes } from './distance'

function timeToMinutes(t: string): number { const [h,m] = t.split(':').map(Number); return h*60+m }
function intervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean { return s1 < e2 && s2 < e1 }

export function detectConflicts(attractions: Attraction[], restaurants: Restaurant[], mode: TransportMode): Conflict[] {
  const conflicts: Conflict[] = []
  const mustA = attractions.filter((a) => a.priority === 'must' && a.timeWindowRequired)
  for (let i = 0; i < mustA.length; i++) {
    for (let j = i+1; j < mustA.length; j++) {
      const a = mustA[i]; const b = mustA[j]
      if (!a.timeWindowRequired || !b.timeWindowRequired) continue
      if (a.timeWindowRequired.date !== b.timeWindowRequired.date) continue
      const aS = timeToMinutes(a.timeWindowRequired.startTime); const aE = timeToMinutes(a.timeWindowRequired.endTime)
      const bS = timeToMinutes(b.timeWindowRequired.startTime); const bE = timeToMinutes(b.timeWindowRequired.endTime)
      const travel = travelMinutes(a.location, b.location, mode)
      if (intervalsOverlap(aS, aE, bS, bE)) {
        const gap = Math.max(aE,bE) - Math.min(aS,bS) - (aE-aS) - (bE-bS)
        if (gap < travel) conflicts.push({ type: 'time_overlap', itemA: a.name, itemB: b.name, message: `「${a.name}」要求 ${a.timeWindowRequired.startTime}–${a.timeWindowRequired.endTime}，「${b.name}」要求 ${b.timeWindowRequired.startTime}–${b.timeWindowRequired.endTime}，時段重疊且交通時間不足（需 ${travel} 分鐘）` })
      } else {
        const gap = Math.abs(bS - aE)
        if (gap < travel) conflicts.push({ type: 'distance_infeasible', itemA: a.name, itemB: b.name, message: `「${a.name}」結束後到「${b.name}」需 ${travel} 分鐘，但兩者時段間隔僅 ${gap} 分鐘` })
      }
    }
  }
  void restaurants
  return conflicts
}
