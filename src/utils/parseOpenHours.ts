import type { OpenHours } from '../types'

interface GooglePeriod {
  open: { day: number; hour: number; minute: number }
  close?: { day: number; hour: number; minute: number } | null
}

const GOOGLE_DAY_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// weekdayDescriptions 順序：Mon=0 … Sun=6
const WD_TO_KEY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function to24h(time: string, ampm: string): string {
  let [h, m] = time.split(':').map(Number)
  if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 解析 Google Places API 回傳的 weekdayDescriptions（最可靠來源）
 * 陣列長度固定為 7，順序 Mon~Sun
 * 範例：["星期一: 05:00–00:00", "星期二: 24 小時", ..., "星期日: 00:00–05:00"]
 */
export function parseWeekdayDescriptions(descriptions: string[]): OpenHours | null {
  const result: OpenHours = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }
  let matched = 0

  for (let i = 0; i < Math.min(descriptions.length, 7); i++) {
    const dayKey = WD_TO_KEY[i] as keyof OpenHours
    // 去掉「星期X: 」或「Monday: 」前綴
    const content = descriptions[i].replace(/^[^:：]+[:：]\s*/, '').trim()

    // 24 小時（中文或英文）
    if (/24\s*小時|open\s+24\s+hours/i.test(content)) {
      result[dayKey] = { open: '00:00', close: '23:59' }
      matched++
      continue
    }

    // 公休 / 休息
    if (/^(休息|公休|關閉|closed)$/i.test(content)) {
      result[dayKey] = null
      matched++
      continue
    }

    // 中文格式 HH:MM–HH:MM（可能有多段，取首開到末關）
    const zhRanges = [...content.matchAll(/(\d{1,2}:\d{2})\s*[–—\-]\s*(\d{1,2}:\d{2})/g)]
    if (zhRanges.length > 0) {
      const open = zhRanges[0][1].padStart(5, '0')
      const close = zhRanges[zhRanges.length - 1][2].padStart(5, '0')
      result[dayKey] = { open, close }
      matched++
      continue
    }

    // 英文格式 5:00 AM – 12:00 AM（可能有多段）
    const enRanges = [...content.matchAll(/(\d{1,2}:\d{2})\s*(AM|PM)\s*[–—\-]\s*(\d{1,2}:\d{2})\s*(AM|PM)/gi)]
    if (enRanges.length > 0) {
      const open = to24h(enRanges[0][1], enRanges[0][2])
      const close = to24h(enRanges[enRanges.length - 1][3], enRanges[enRanges.length - 1][4])
      result[dayKey] = { open, close }
      matched++
    }
  }

  return matched > 0 ? result : null
}

export function parseGoogleOpenHours(periods: GooglePeriod[]): OpenHours {
  const result: OpenHours = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }

  if (periods.length === 1 && periods[0].open?.day === 0 && !periods[0].close) {
    const h = { open: '00:00', close: '23:59' }
    return { mon: h, tue: h, wed: h, thu: h, fri: h, sat: h, sun: h }
  }

  for (const p of periods) {
    if (p.open?.day == null) continue
    const dayKey = GOOGLE_DAY_TO_KEY[p.open.day] as keyof OpenHours
    const openStr = `${String(p.open.hour ?? 0).padStart(2, '0')}:${String(p.open.minute ?? 0).padStart(2, '0')}`

    if (p.close?.day == null) {
      result[dayKey] = { open: '00:00', close: '23:59' }
    } else {
      const closeH = p.close.hour ?? 0
      const closeStr = closeH >= 24
        ? `${String(closeH - 24).padStart(2, '0')}:${String(p.close.minute ?? 0).padStart(2, '0')}`
        : `${String(closeH).padStart(2, '0')}:${String(p.close.minute ?? 0).padStart(2, '0')}`
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
