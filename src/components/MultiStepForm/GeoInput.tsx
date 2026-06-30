import { useState, useRef, useEffect } from 'react'
import type { GeoPoint, OpenHours } from '../../types'
import { DAY_KEYS, DAY_LABELS } from '../../types'
import { parseOsmOpeningHours, parseGoogleOpenHours, parseWeekdayDescriptions } from '../../utils/parseOpenHours'
import { searchPlaceHistory } from '../../lib/history'
import type { PlaceHistory } from '../../lib/history'

const ALL_OPEN: OpenHours = {
  mon: { open: '00:00', close: '23:59' }, tue: { open: '00:00', close: '23:59' },
  wed: { open: '00:00', close: '23:59' }, thu: { open: '00:00', close: '23:59' },
  fri: { open: '00:00', close: '23:59' }, sat: { open: '00:00', close: '23:59' },
  sun: { open: '00:00', close: '23:59' },
}

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined
const USE_GOOGLE = !!GOOGLE_KEY

interface PlaceResult {
  lat: string
  lon: string
  display_name: string
  short_name: string
  osm_type?: string
  osm_id?: number
  google_place_id?: string
}

interface Props {
  value: GeoPoint
  onChange: (v: GeoPoint) => void
  onOpenHours?: (hours: OpenHours) => void
  onNameChange?: (name: string) => void
  nameValue?: string
  label: string
  placeholder?: string
}

async function searchGoogle(q: string): Promise<PlaceResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: q, languageCode: 'zh-TW', regionCode: 'TW' }),
  })
  const data = await res.json()
  return (data.places ?? []).slice(0, 6).map((p: Record<string, unknown>) => {
    const loc = p.location as Record<string, number>
    const displayName = (p.displayName as Record<string, string>)?.text ?? ''
    const formattedAddress = (p.formattedAddress as string) ?? ''
    return {
      lat: String(loc?.latitude ?? 0),
      lon: String(loc?.longitude ?? 0),
      display_name: formattedAddress || displayName,
      short_name: displayName,
      google_place_id: p.id as string,
    }
  })
}

async function fetchGoogleHours(placeId: string): Promise<OpenHours | null> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_KEY!, 'X-Goog-FieldMask': 'regularOpeningHours' },
  })
  const data = await res.json()
  const roh = data.regularOpeningHours
  if (!roh) return null

  // weekdayDescriptions 是 Google 直接顯示給用戶的文字，最可靠
  if (Array.isArray(roh.weekdayDescriptions) && roh.weekdayDescriptions.length === 7) {
    const hours = parseWeekdayDescriptions(roh.weekdayDescriptions)
    if (hours) return hours
  }

  // fallback：解析 periods 結構
  return roh.periods?.length ? parseGoogleOpenHours(roh.periods) : null
}

async function searchNominatim(q: string, countryCode?: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ format: 'json', q, limit: '6', addressdetails: '0', 'accept-language': 'zh-TW,zh' })
  if (countryCode) params.set('countrycodes', countryCode)
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'TravelPlannerApp/1.0' },
  })
  const data: Array<Record<string, unknown>> = await res.json()
  return data.map((r) => ({
    lat: r.lat as string, lon: r.lon as string,
    display_name: r.display_name as string,
    short_name: (r.display_name as string).split(',')[0].trim(),
    osm_type: r.osm_type as string, osm_id: r.osm_id as number,
  }))
}

async function fetchOsmHours(osmType: string, osmId: number): Promise<OpenHours | null> {
  const type = osmType === 'node' ? 'node' : osmType === 'way' ? 'way' : 'relation'
  const query = `[out:json];${type}(${osmId});out tags;`
  const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
  const data = await res.json()
  const osmHours = data?.elements?.[0]?.tags?.opening_hours
  return osmHours ? parseOsmOpeningHours(osmHours) : null
}

async function doSearch(q: string): Promise<PlaceResult[]> {
  if (USE_GOOGLE) return searchGoogle(q)
  let data = await searchNominatim(q, 'tw')
  if (data.length === 0) data = await searchNominatim(`${q} 台灣`, 'tw')
  if (data.length === 0) data = await searchNominatim(q)
  return data
}

async function doFetchHours(r: PlaceResult): Promise<OpenHours | null> {
  if (r.google_place_id) return fetchGoogleHours(r.google_place_id)
  if (r.osm_type && r.osm_id) return fetchOsmHours(r.osm_type, r.osm_id)
  return null
}

export default function GeoInput({ value, onChange, onOpenHours, onNameChange, nameValue, label, placeholder }: Props) {
  const isNameMode = !!onNameChange

  const [loading, setLoading] = useState(false)
  const [hoursStatus, setHoursStatus] = useState<'idle' | 'fetching' | 'found' | 'not_found'>('idle')
  const [pendingHours, setPendingHours] = useState<OpenHours | null>(null)
  const [noHoursWarning, setNoHoursWarning] = useState(false)
  const [internalQuery, setInternalQuery] = useState(() =>
    value.address ? value.address.split(',')[0].trim() : ''
  )
  const [results, setResults] = useState<PlaceResult[]>([])
  const [historyResults, setHistoryResults] = useState<PlaceHistory[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const justSelectedRef = useRef(false)

  const query = isNameMode ? (nameValue ?? '') : internalQuery

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleQueryChange(text: string) {
    if (isNameMode) {
      onNameChange!(text)
    } else {
      setInternalQuery(text)
    }
    if (text.length >= 2 && !justSelectedRef.current) {
      const hist = searchPlaceHistory(text)
      setHistoryResults(hist)
      if (hist.length > 0) setShowDropdown(true)
      else setShowDropdown(false)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => autoSearch(text), 550)
    } else {
      setHistoryResults([])
      setShowDropdown(false)
    }
  }

  async function autoSearch(q: string) {
    if (!q.trim()) return
    setLoading(true)
    try {
      const data = await doSearch(q.trim())
      if (data.length > 0) {
        setResults(data)
        setShowDropdown(true)
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  function selectHistory(h: PlaceHistory) {
    justSelectedRef.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)

    onChange(h.location)
    if (isNameMode) onNameChange!(h.name)
    else setInternalQuery(h.name)

    setShowDropdown(false)
    setResults([])
    setHistoryResults([])

    if (onOpenHours) {
      onOpenHours(h.openHours)
      setHoursStatus('found')
    }
    setTimeout(() => { justSelectedRef.current = false }, 800)
  }

  async function search() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setHoursStatus('idle')
    setShowDropdown(false)
    setResults([])
    try {
      const data = await doSearch(q)
      if (data.length === 0) {
        alert('找不到此地點，請嘗試加上縣市（例：九份老街 新北市）')
        return
      }
      if (data.length === 1) {
        await selectResult(data[0])
      } else {
        setResults(data)
        setShowDropdown(true)
      }
    } catch {
      alert('搜尋失敗，請檢查網路後再試')
    } finally {
      setLoading(false)
    }
  }

  async function selectResult(r: PlaceResult) {
    justSelectedRef.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)

    onChange({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: r.display_name })

    const selectedName = r.short_name || r.display_name.split(',')[0].trim()
    if (isNameMode) {
      onNameChange!(selectedName)
    } else {
      setInternalQuery(selectedName)
    }
    setShowDropdown(false)
    setResults([])

    setTimeout(() => { justSelectedRef.current = false }, 800)

    if (!onOpenHours) return
    setHoursStatus('fetching')
    setPendingHours(null)
    setNoHoursWarning(false)
    try {
      const hours = await doFetchHours(r)
      if (hours) {
        const hasClosedDay = DAY_KEYS.some(d => hours[d] === null)
        if (hasClosedDay) {
          setPendingHours(hours)
        } else {
          onOpenHours(hours)
        }
        setHoursStatus('found')
      } else {
        onOpenHours(ALL_OPEN)
        setNoHoursWarning(true)
        setHoursStatus('not_found')
      }
    } catch {
      onOpenHours(ALL_OPEN)
      setNoHoursWarning(true)
      setHoursStatus('not_found')
    }
  }

  const inputPlaceholder = placeholder ?? (
    isNameMode
      ? '輸入名稱自動搜尋並定位（例：日月潭）'
      : '輸入景點或地址（例：九份老街、台北 101）'
  )

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="label">{label}</label>}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
          placeholder={inputPlaceholder}
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="btn-primary px-3 whitespace-nowrap text-sm"
        >
          {loading ? '搜尋中…' : '搜尋'}
        </button>
      </div>

      <div className="mt-1 space-y-0.5">
        {value.lat !== 0 && !showDropdown && isNameMode && (
          <p className="text-xs text-green-600 truncate">
            已定位：{value.address.split(',').slice(0, 2).join(',')}
            {USE_GOOGLE ? ' · Google Maps' : ''}
          </p>
        )}
        {value.lat !== 0 && !showDropdown && !isNameMode && (
          <p className="text-xs text-green-600">
            已定位：{value.lat.toFixed(4)}, {value.lng.toFixed(4)}{USE_GOOGLE ? ' · Google Maps' : ''}
          </p>
        )}
        {hoursStatus === 'fetching' && <p className="text-xs text-blue-500">正在抓取營業時間…</p>}
        {hoursStatus === 'found' && !pendingHours && <p className="text-xs text-green-600">已自動填入營業時間</p>}
      </div>

      {pendingHours && onOpenHours && (
        <div className="mt-2 border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800">
            Google Maps 回傳的營業時間含公休日，請確認是否正確：
          </p>
          <div className="flex flex-wrap gap-1">
            {DAY_KEYS.map(day => {
              const h = pendingHours[day]
              return h ? (
                <span key={day} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                  週{DAY_LABELS[day]} {h.open}–{h.close}
                </span>
              ) : (
                <span key={day} className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">
                  週{DAY_LABELS[day]} 休
                </span>
              )
            })}
          </div>
          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => { onOpenHours(pendingHours); setPendingHours(null) }}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded font-medium"
            >
              套用此資料
            </button>
            <button
              type="button"
              onClick={() => { onOpenHours(ALL_OPEN); setPendingHours(null) }}
              className="text-xs bg-white hover:bg-amber-50 border border-amber-400 text-amber-700 px-3 py-1.5 rounded font-medium"
            >
              全天開放（無休）
            </button>
          </div>
        </div>
      )}

      {showDropdown && (historyResults.length > 0 || results.length > 0) && (
        <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-72 overflow-y-auto">
          {historyResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                歷史紀錄
              </div>
              {historyResults.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="w-full text-left px-4 py-2.5 hover:bg-amber-50 border-b border-gray-100 transition-colors flex items-center gap-2"
                  onClick={() => selectHistory(h)}
                >
                  <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded flex-shrink-0">歷史</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">{h.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{h.location.address.split(',').slice(0, 2).join(',')}</div>
                  </div>
                </button>
              ))}
            </>
          )}
          {results.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5">
                搜尋結果
                {USE_GOOGLE && <span className="text-blue-400">· Google Maps</span>}
              </div>
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                  onClick={() => selectResult(r)}
                >
                  <div className="text-sm font-medium text-gray-900">{r.short_name || r.display_name.split(',')[0]}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{r.display_name}</div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
