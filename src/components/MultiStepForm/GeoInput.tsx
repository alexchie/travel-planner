import { useState } from 'react'
import type { GeoPoint } from '../../types'

interface Props {
  value: GeoPoint
  onChange: (v: GeoPoint) => void
  label: string
}

export default function GeoInput({ value, onChange, label }: Props) {
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(value.address)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW' } })
      const data = await res.json()
      if (data.length > 0) {
        onChange({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name,
        })
        setQuery(data[0].display_name)
      } else {
        alert('找不到此地點，請嘗試更具體的描述')
      }
    } catch {
      alert('地點搜尋失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="輸入地址或景點名稱"
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
      {value.lat !== 0 && (
        <p className="text-xs text-green-600 mt-1">
          座標：{value.lat.toFixed(4)}, {value.lng.toFixed(4)}
        </p>
      )}
    </div>
  )
}
