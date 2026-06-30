import type { OpenHours } from '../types'

interface GooglePeriod {
  open: { day: number; hour: number; minute: number }
  close?: { day: number; hour: number; minute: number } | null
}

const GOOGLE_DAY_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function parseGoogleOpenHours(periods: GooglePeriod[]): OpenHours {
  const result: OpenHours = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }

  // Google 以單一無 close 的 period 表示完全 24/7
  if (periods.length === 1 && periods[0].open?.day === 0 && !periods[0].close) {
    const h = { open: '00:00', close: '23:59' }
    return { mon: h, tue: h, wed: h, thu: h, fri: h, sat: h, sun: h }
  }

  for (const p of periods) {
    if (p.open?.day == null) continue
    const dayKey = GOOGLE_DAY_TO_KEY[p.open.day] as keyof OpenHours
    const openStr = `${String(p.open.hour ?? 0).padStart(2, '0')}:${String(p.open.minute ?? 0).padStart(2, '0')}`

    if (p.close?.day == null) {
      // close 欄位不存在 = 當天 24 小時營業
      result[dayKey] = { open: '00:00', close: '23:59' }
    } else {
      const closeStr = `${String(p.close.hour ?? 0).padStart(2, '0')}:${String(p.close.minute ?? 0).padStart(2, '0')}`
      result[dayKey] = { open: openStr, close: closeStr }
    }
  }

  return result
}

const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const
const OSM_TO_KEY: Record<string, keyof OpenHours> = {
  Mo: 'mon', Tu: 'tue', We: 'wed', Th: 'thu', Fr: 'fri', Sa: 'sat', Su: 'sun',
}

function expandDayStr(dayStr: string): Array<keyof OpenHours> {
  const keys: Array<keyof OpenHours> = []
  for (const segment of dayStr.split(',')) {
    const s = segment.trim()
    if (s.includes('-')) {
      const [from, to] = s.split('-').map((d) => d.trim())
      const fromIdx = OSM_DAYS.indexOf(from as typeof OSM_DAYS[number])
      const toIdx = OSM_DAYS.indexOf(to as typeof OSM_DAYS[number])
      if (fromIdx === -1 || toIdx === -1) continue
      if (fromIdx <= toIdx) {
        for (let i = fromIdx; i <= toIdx; i++) keys.push(OSM_TO_KEY[OSM_DAYS[i]])
      } else {
        for (let i = fromIdx; i < OSM_DAYS.length; i++) keys.push(OSM_TO_KEY[OSM_DAYS[i]])
        for (let i = 0; i <= toIdx; i++) keys.push(OSM_TO_KEY[OSM_DAYS[i]])
      }
    } else {
      const key = OSM_TO_KEY[s]
      if (key) keys.push(key)
    }
  }
  return keys
}

function padTime(t: string): string {
  return t.length === 4 ? `0${t}` : t
}

export function parseOsmOpeningHours(osmStr: string): OpenHours | null {
  if (!osmStr?.trim()) return null

  const result: OpenHours = {
    mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
  }

  if (osmStr.trim() === '24/7') {
    const h = { open: '00:00', close: '23:59' }
    return { mon: h, tue: h, wed: h, thu: h, fri: h, sat: h, sun: h }
  }

  const rules = osmStr.split(';').map((r) => r.trim()).filter(Boolean)
  let matched = false

  for (const rule of rules) {
    const m = rule.match(/^([A-Za-z,\-]+)\s*([\d:]+ *- *[\d:]+|off|closed)?$/i)
    if (!m) continue
    const days = expandDayStr(m[1])
    const timeStr = (m[2] ?? '').trim().toLowerCase()
    for (const day of days) {
      matched = true
      if (!timeStr || timeStr === 'off' || timeStr === 'closed') {
        result[day] = null
      } else {
        const tm = timeStr.match(/(\d{1,2}:\d{2}) *- *(\d{1,2}:\d{2})/)
        if (tm) {
          result[day] = { open: padTime(tm[1]), close: padTime(tm[2]) }
        }
      }
    }
  }

  return matched ? result : null
}
