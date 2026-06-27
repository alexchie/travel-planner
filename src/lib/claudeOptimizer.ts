import { v4 as uuidv4 } from 'uuid'
import type { TripInfo, Attraction, Restaurant, Accommodation, DayItinerary, GeoPoint } from '../types'
import { MEAL_TYPE_LABEL, TRANSPORT_LABEL } from '../types'
import { computeTravelMatrix } from './googleMapsDistance'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
export const isClaudeConfigured = !!ANTHROPIC_KEY

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

  lines.push('你是專業旅遊行程規劃師。根據以下資料規劃最佳多日行程。目標：最小化總交通時間、避免走回頭路、地理相鄰的地點安排在同一天。只輸出 JSON，不要有其他說明文字。')
  lines.push('')
  lines.push(`行程：抵達 ${trip.arrivalDatetime}，離開 ${trip.departureDatetime}，交通方式：${TRANSPORT_LABEL[trip.transportMode]}`)
  lines.push(`每天出發點（第一天以抵達時間為準，之後各天 09:00 出發，22:30 前回住宿）`)

  if (attractions.length > 0) {
    lines.push('')
    lines.push('【景點】')
    attractions.forEach((a) => {
      const tw = a.timeWindowRequired
      lines.push(
        `- [${a.id}] ${a.name} (${a.location.lat},${a.location.lng}) 停留${a.durationMinutes}分 ${a.priority === 'must' ? '必去' : '彈性'}${tw ? ` 限定${tw.date} ${tw.startTime}-${tw.endTime}` : ''}`
      )
    })
  }

  if (restaurants.length > 0) {
    lines.push('')
    lines.push('【餐廳/小吃】')
    restaurants.forEach((r) => {
      lines.push(
        `- [${r.id}] ${r.name} (${r.location.lat},${r.location.lng}) ${MEAL_TYPE_LABEL[r.mealType]} ${r.dishType === 'snack' ? '小吃' : '正餐'} ${r.priority === 'must' ? '必去' : '彈性'}`
      )
    })
  }

  if (accommodations.length > 0) {
    lines.push('')
    lines.push('【住宿（每晚必須抵達，作為次日起點）】')
    accommodations.forEach((a) => {
      lines.push(`- 第${a.dayIndex}天晚：${a.name} (${a.location.lat},${a.location.lng})`)
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
  lines.push('【規則】')
  lines.push('- 早餐 07:00-10:00、午餐 11:30-14:00、下午茶 14:30-17:00、晚餐 17:30-21:00、都可以=彈性')
  lines.push('- 必去景點/餐廳一定要排入；彈性可省略')
  lines.push('- 同一天地點需地理相鄰，嚴格避免來回奔波')
  lines.push('- travelTimeToNext 請填入兩個相鄰地點間的實際交通分鐘數')
  lines.push('')
  lines.push('【輸出格式（JSON 陣列，每天一個元素）】')
  lines.push(JSON.stringify([{
    dayIndex: 1, date: 'YYYY-MM-DD',
    stops: [{
      id: 'uuid', type: 'attraction|restaurant|accommodation',
      name: '地點名稱', location: { lat: 0, lng: 0, address: '' },
      arrivalTime: 'HH:MM', departureTime: 'HH:MM',
      durationMinutes: 60, travelTimeToNext: 20,
      hasWarning: false, mealType: null
    }],
    totalTravelMinutes: 60, hasConstraintWarning: false
  }]))

  return lines.join('\n')
}

export async function optimizeWithClaude(
  trip: TripInfo,
  attractions: Attraction[],
  restaurants: Restaurant[],
  accommodations: Accommodation[]
): Promise<DayItinerary[]> {
  const locs: GeoPoint[] = [
    trip.startLocation,
    ...attractions.map((a) => a.location),
    ...restaurants.map((r) => r.location),
    ...accommodations.map((a) => a.location),
  ]
  const locNames: string[] = [
    '起點',
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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: buildPrompt(trip, attractions, restaurants, accommodations, locs, locNames, matrix) }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = (data.content?.[0]?.text ?? '') as string
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const jsonStr = extractJsonArray(clean)
  if (!jsonStr) throw new Error('Claude 未回傳有效 JSON')

  const itinerary = JSON.parse(jsonStr) as DayItinerary[]
  return itinerary.map((day) => ({
    ...day,
    stops: day.stops.map((stop) => ({ ...stop, id: stop.id || uuidv4() })),
  }))
}
