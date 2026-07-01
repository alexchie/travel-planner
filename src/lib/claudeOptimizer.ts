import { v4 as uuidv4 } from 'uuid'
import type { TripInfo, Attraction, Restaurant, Accommodation, DayItinerary, GeoPoint, OpenHours, Stop } from '../types'
import { MEAL_TYPE_LABEL, TRANSPORT_LABEL } from '../types'
import { computeTravelMatrix } from './googleMapsDistance'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
export const isClaudeConfigured = !!ANTHROPIC_KEY

function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (inString) {
      if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function timeToMinutes(t: string): number {
  const [h, m] = (t ?? '00:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function effectiveCloseMin(openStr: string, closeStr: string): number {
  const o = timeToMinutes(openStr)
  let c = timeToMinutes(closeStr)
  if (c === 0) c = 1440
  if (c <= o) c += 1440
  return c
}

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DOW_ZH = ['日', '一', '二', '三', '四', '五', '六']

function formatOpenHours(oh: OpenHours): string {
  const parts: string[] = []
  DOW_KEYS.forEach((k, i) => {
    const h = oh[k]
    parts.push(h ? `${DOW_ZH[i]}${h.open}-${h.close}` : `${DOW_ZH[i]}休`)
  })
  return parts.join(' ')
}

function getTripDates(arrivalDatetime: string, departureDatetime: string): string[] {
  const dates: string[] = []
  const start = new Date(arrivalDatetime.slice(0, 10))
  const end = new Date(departureDatetime.slice(0, 10))
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function matchOriginalItem(
  stop: Stop,
  attractions: Attraction[],
  restaurants: Restaurant[],
): Attraction | Restaurant | undefined {
  const byCoord = (item: { location: { lat: number; lng: number } }) =>
    Math.abs(item.location.lat - stop.location.lat) < 0.001 &&
    Math.abs(item.location.lng - stop.location.lng) < 0.001
  const byName = (item: { name: string }) =>
    item.name.trim().toLowerCase() === stop.name.trim().toLowerCase()

  return (
    attractions.find(a => byCoord(a) || byName(a)) ??
    restaurants.find(r => byCoord(r) || byName(r))
  )
}

function validateAndDedup(
  itinerary: DayItinerary[],
  attractions: Attraction[],
  restaurants: Restaurant[],
): DayItinerary[] {
  const seenIds = new Set<string>()

  return itinerary.map((day) => {
    const dowIdx = day.date ? new Date(day.date).getDay() : -1
    const dowKey = dowIdx >= 0 ? DOW_KEYS[dowIdx] : null

    const validStops: Stop[] = []
    for (const stop of day.stops) {
      if (stop.type === 'accommodation') {
        validStops.push(stop)
        continue
      }

      if (stop.isAiRecommended) {
        validStops.push(stop)
        continue
      }

      const original = matchOriginalItem(stop, attractions, restaurants)
      const dedupeKey = original?.id ?? stop.name.trim().toLowerCase()
      if (seenIds.has(dedupeKey)) continue
      seenIds.add(dedupeKey)

      // Normalise name to original, attach itemId and carry over user notes
      let s: Stop = original
        ? { ...stop, name: original.name, itemId: original.id, notes: original.notes }
        : { ...stop }

      // Business hours check — remove conflicting stops entirely
      if (dowKey && original) {
        const dh = original.openHours[dowKey]
        if (!dh) continue  // closed this day → skip (appears as unscheduled)

        const open = timeToMinutes(dh.open)
        const close = effectiveCloseMin(dh.open, dh.close)
        const arrival = timeToMinutes(s.arrivalTime)
        const departure = timeToMinutes(s.departureTime)
        if (arrival < open || departure > close) continue  // outside hours → skip
      }

      validStops.push(s)
    }

    return { ...day, stops: validStops }
  })
}

function buildPrompt(
  trip: TripInfo,
  attractions: Attraction[],
  restaurants: Restaurant[],
  accommodations: Accommodation[],
  locs: GeoPoint[],
  locNames: string[],
  matrix: number[][] | null
): string {
  const lines: string[] = []
  const startName = trip.startLocation.address || '起點'
  const endName = trip.endLocation.address || '終點'
  const arrivalTime = trip.arrivalDatetime.split('T')[1]?.slice(0, 5) ?? '09:00'
  const departureTime = trip.departureDatetime.split('T')[1]?.slice(0, 5) ?? '18:00'
  const totalDays = accommodations.length + 1
  const tripDates = getTripDates(trip.arrivalDatetime, trip.departureDatetime)

  lines.push('你是專業旅遊行程規劃師。根據以下資料規劃最佳多日行程。目標：最小化總交通時間、避免走回頭路、地理相鄰的地點安排在同一天。只輸出 JSON，不要有其他說明文字。')
  lines.push('')
  lines.push(`行程：抵達 ${trip.arrivalDatetime}，離開 ${trip.departureDatetime}，交通方式：${TRANSPORT_LABEL[trip.transportMode]}，共 ${totalDays} 天`)
  lines.push('')
  lines.push('行程日期（請注意星期對應營業時間）：')
  tripDates.forEach((date, i) => {
    const dow = DOW_ZH[new Date(date).getDay()]
    lines.push(`  第${i + 1}天 ${date}(星期${dow})`)
  })
  lines.push('')
  lines.push(`起點：${startName} (${trip.startLocation.lat},${trip.startLocation.lng})`)
  lines.push(`終點：${endName} (${trip.endLocation.lat},${trip.endLocation.lng})`)

  if (accommodations.length > 0) {
    lines.push('')
    lines.push('【住宿】')
    accommodations.forEach((a) => {
      lines.push(`- 第${a.dayIndex}天晚：${a.name} (${a.location.lat},${a.location.lng})`)
    })
  }

  if (attractions.length > 0) {
    lines.push('')
    lines.push('【景點】')
    attractions.forEach((a) => {
      const tw = a.timeWindowRequired
      const hours = formatOpenHours(a.openHours)
      lines.push(
        `- [${a.id}] ${a.name} (${a.location.lat},${a.location.lng}) 停留${a.durationMinutes}分 ${a.priority === 'must' ? '必去' : '彈性'}${tw ? ` 限定${tw.date} ${tw.startTime}-${tw.endTime}` : ''} 營業：${hours}`
      )
    })
  }

  if (restaurants.length > 0) {
    lines.push('')
    lines.push('【餐廳/小吃】')
    restaurants.forEach((r) => {
      const hours = formatOpenHours(r.openHours)
      lines.push(
        `- [${r.id}] ${r.name} (${r.location.lat},${r.location.lng}) ${MEAL_TYPE_LABEL[r.mealType]} ${r.dishType === 'snack' ? '小吃' : '正餐'} ${r.priority === 'must' ? '必去' : '彈性'} 營業：${hours}`
      )
    })
  }

  lines.push('')
  if (matrix) {
    lines.push('【Google Maps 實際交通時間（分鐘）— 請據此最小化路線總時間】')
    const pairs: string[] = []
    for (let i = 0; i < locs.length; i++) {
      for (let j = 0; j < locs.length; j++) {
        if (i !== j && matrix[i][j] > 0 && matrix[i][j] < 180) {
          pairs.push(`${locNames[i]}→${locNames[j]}:${matrix[i][j]}`)
        }
      }
    }
    lines.push(pairs.join(', '))
  } else {
    lines.push('（Google Maps 交通資料不可用，請根據座標估算距離）')
  }

  lines.push('')
  lines.push('【最高優先原則（所有規則中優先級最高，不得違反）】')
  lines.push('- 用戶提供的所有景點與餐廳必須優先排入行程，直到全數排完（或因營業時間無法安排才可放棄）')
  lines.push('- isAiRecommended: true 的 AI 推薦地點只能在以下兩種情況使用：')
  lines.push('  1. 用戶提供的同餐別餐廳已全數排完，但該天仍缺少早/午/晚某一餐')
  lines.push('  2. 用戶提供的所有景點已全數排完，且兩餐之間完全沒有景點可填充')
  lines.push('- 絕對禁止：用戶景點或餐廳尚未排完時，就推薦 AI 地點取而代之')

  lines.push('')
  lines.push('【規則—地理】')
  lines.push('- 必去景點/餐廳一定要排入；彈性可省略')
  lines.push('- 同一天地點需地理相鄰，嚴格避免來回奔波')
  lines.push('- 每個地點只能在整個行程中出現一次，不得重複排入')
  lines.push('- travelTimeToNext 填入到下一個地點的交通分鐘（最後一個 stop 填 0）')

  lines.push('')
  lines.push('【規則—不得重複（嚴格遵守）】')
  lines.push('- 同一家餐廳或景點在整個行程中只能出現一次，無論是哪一天')
  lines.push('- 若需推薦 AI 餐廳，絕對不得重複使用已出現過的餐廳')

  lines.push('')
  lines.push('【規則—營業時間（嚴格遵守，違反即視為無效行程）】')
  lines.push('- 每個地點的 arrivalTime 必須 >= 該天營業開始時間')
  lines.push('- 每個地點的 departureTime (= arrivalTime + durationMinutes) 必須 <= 該天營業結束時間')
  lines.push('- 若地點在該天標註為「休」，絕對不得安排在那一天，必須改安排到其他天或省略')
  lines.push('- 最終輸出的每一個 stop 都必須是用戶實際可以前往的，不得出現任何違反營業時間的安排')
  lines.push('- 若無法在合法時段內安排某地點，寧可省略該地點，也不可排入違規時段')

  lines.push('')
  lines.push('【規則—餐食（嚴格遵守）】')
  lines.push('【必要餐別】每天一定要安排早餐、午餐、晚餐各一個正餐（full_meal），這三餐是每天的硬性規定，不得省略。')
  lines.push('【可選餐別】下午茶、宵夜為可選，若行程有排才加入，且這兩個餐別只能排小吃（snack），絕對不可排正餐（full_meal）。')
  lines.push('【時段定義】')
  lines.push('  - 早餐：08:00–10:30（arrivalTime 必須在此區間內）')
  lines.push('  - 午餐：11:00–14:00（arrivalTime 必須在此區間內）')
  lines.push('  - 晚餐：18:00–21:00（arrivalTime 必須在此區間內）')
  lines.push('  - 下午茶：14:00–18:00（可選，限小吃，最多 1~2 個）')
  lines.push('  - 宵夜：21:00–00:00（可選，限小吃，最多 1~2 個）')
  lines.push('【餐廳不足時的處理】')
  lines.push('- 僅當用戶提供的同餐別餐廳已全部排完，且該天仍缺少早/午/晚某餐時，才可推薦新餐廳（isAiRecommended: true）')
  lines.push('【其他限制】')
  lines.push('- 每天每個必要餐別（早/午/晚）各最多 1 個正餐，絕對不能同一天出現兩個午餐正餐')
  lines.push('- 小吃（snack）不佔正餐名額，可在景點之間額外插入')
  lines.push('- 【補景規則】僅當用戶提供的所有景點已全數排完後，若兩餐之間仍無任何景點，才可插入 AI 推薦景點（isAiRecommended: true）')

  lines.push('')
  lines.push('【每天 stops 陣列結構（嚴格遵守，不得違反）】')

  if (accommodations.length === 0) {
    lines.push('單日行程：')
    lines.push(`  stops[0]   = 起點 { type:"accommodation", name:"起點：${startName}", lat:${trip.startLocation.lat}, lng:${trip.startLocation.lng}, arrivalTime:"${arrivalTime}", departureTime:"${arrivalTime}", durationMinutes:0 }`)
    lines.push('  stops[1..N-1] = 景點/餐廳')
    lines.push(`  stops[最後] = 終點 { type:"accommodation", name:"終點：${endName}", lat:${trip.endLocation.lat}, lng:${trip.endLocation.lng}, departureTime:"${departureTime}", durationMinutes:0, travelTimeToNext:0 }`)
  } else {
    const accom = (d: number) => accommodations.find(a => a.dayIndex === d)

    lines.push(`第1天：`)
    lines.push(`  stops[0]   = 起點 { type:"accommodation", name:"起點：${startName}", lat:${trip.startLocation.lat}, lng:${trip.startLocation.lng}, arrivalTime:"${arrivalTime}", departureTime:"${arrivalTime}", durationMinutes:0, travelTimeToNext:起點→第一景點交通分鐘 }`)
    lines.push('  stops[1..N-1] = 景點/餐廳')
    lines.push(`  stops[最後] = 第1晚住宿「${accom(1)?.name ?? '住宿'}」 { type:"accommodation", travelTimeToNext:0 }`)

    for (let d = 2; d <= totalDays - 1; d++) {
      const prev = accom(d - 1)
      const curr = accom(d)
      lines.push(`第${d}天：`)
      lines.push(`  stops[0]   = 前一晚住宿「${prev?.name ?? ''}」 { type:"accommodation", lat:${prev?.location.lat ?? 0}, lng:${prev?.location.lng ?? 0}, arrivalTime:"09:00", departureTime:"09:00", durationMinutes:0, travelTimeToNext:住宿→第一景點交通分鐘 }`)
      lines.push('  stops[1..N-1] = 景點/餐廳')
      lines.push(`  stops[最後] = 第${d}晚住宿「${curr?.name ?? '住宿'}」 { type:"accommodation", travelTimeToNext:0 }`)
    }

    const lastAccom = accom(accommodations.length)
    lines.push(`第${totalDays}天（最後一天）：`)
    lines.push(`  stops[0]   = 前一晚住宿「${lastAccom?.name ?? ''}」 { type:"accommodation", lat:${lastAccom?.location.lat ?? 0}, lng:${lastAccom?.location.lng ?? 0}, arrivalTime:"09:00", departureTime:"09:00", durationMinutes:0, travelTimeToNext:住宿→第一景點交通分鐘 }`)
    lines.push('  stops[1..N-1] = 景點/餐廳')
    lines.push(`  stops[最後] = 終點 { type:"accommodation", name:"終點：${endName}", lat:${trip.endLocation.lat}, lng:${trip.endLocation.lng}, arrivalTime:預計抵達時間, departureTime:"${departureTime}", durationMinutes:0, travelTimeToNext:0 }`)
  }

  lines.push('')
  lines.push('【輸出格式（JSON 陣列，每天一個元素）】')
  lines.push(JSON.stringify([{
    dayIndex: 1, date: 'YYYY-MM-DD',
    stops: [{
      id: 'uuid', type: 'attraction|restaurant|accommodation',
      name: '地點名稱', location: { lat: 0, lng: 0, address: '' },
      arrivalTime: 'HH:MM', departureTime: 'HH:MM',
      durationMinutes: 60, travelTimeToNext: 20,
      hasWarning: false, mealType: null, isAiRecommended: false
    }],
    totalTravelMinutes: 60, hasConstraintWarning: false
  }]))

  return lines.join('\n')
}

const SYSTEM_PROMPT = `你是旅遊行程規劃 AI。你的唯一任務是輸出符合格式的 JSON 陣列。
規則：
- 絕對只輸出 JSON，第一個字元必須是 [，最後一個字元必須是 ]
- 不得輸出任何說明、標題、markdown、code block 或其他文字
- JSON 必須完整且合法，不得截斷`

async function callClaudeOnce(prompt: string): Promise<DayItinerary[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': ANTHROPIC_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (e) {
    const isAbort = e instanceof DOMException && e.name === 'AbortError'
    throw new Error(isAbort ? '逾時（90 秒）' : `網路錯誤：${String(e)}`)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = (data.content?.[0]?.text ?? '') as string
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const jsonStr = extractJsonArray(clean)
  if (!jsonStr) throw new Error(`未回傳有效 JSON（回應前 200 字：${clean.slice(0, 200)}）`)

  const raw = JSON.parse(jsonStr) as DayItinerary[]
  return raw.map((day) => ({
    ...day,
    stops: day.stops.map((stop) => ({ ...stop, id: stop.id || uuidv4() })),
  }))
}

export async function optimizeWithClaude(
  trip: TripInfo,
  attractions: Attraction[],
  restaurants: Restaurant[],
  accommodations: Accommodation[]
): Promise<DayItinerary[]> {
  const locs: GeoPoint[] = [
    trip.startLocation,
    trip.endLocation,
    ...attractions.map((a) => a.location),
    ...restaurants.map((r) => r.location),
    ...accommodations.map((a) => a.location),
  ]
  const locNames: string[] = [
    '起點',
    '終點',
    ...attractions.map((a) => a.name.slice(0, 5) || `景${attractions.indexOf(a)}`),
    ...restaurants.map((r) => r.name.slice(0, 5) || `餐${restaurants.indexOf(r)}`),
    ...accommodations.map((a) => `宿${a.dayIndex}`),
  ]

  let matrix: number[][] | null = null
  try {
    matrix = await computeTravelMatrix(locs, trip.transportMode)
  } catch (e) {
    console.warn('Google Maps distance matrix failed:', e)
  }

  const prompt = buildPrompt(trip, attractions, restaurants, accommodations, locs, locNames, matrix)

  const MAX_ATTEMPTS = 3
  let lastError = ''
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const itinerary = await callClaudeOnce(prompt)
      return validateAndDedup(itinerary, attractions, restaurants)
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1500 * attempt))
      }
    }
  }

  throw new Error(`${MAX_ATTEMPTS} 次嘗試均失敗，最後錯誤：${lastError}`)
}
