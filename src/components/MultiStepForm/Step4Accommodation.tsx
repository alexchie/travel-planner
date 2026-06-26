import { useState } from 'react'
import { useDispatch, useAppState } from '../../store'
import type { Accommodation, GeoPoint } from '../../types'
import GeoInput from './GeoInput'

const EMPTY_GEO: GeoPoint = { lat: 0, lng: 0, address: '' }

export default function Step4Accommodation() {
  const { accommodations, trip } = useAppState()
  const dispatch = useDispatch()

  const tripDays = trip
    ? Math.ceil(
        (new Date(trip.departureDatetime).getTime() -
          new Date(trip.arrivalDatetime).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 1

  const [list, setList] = useState<Accommodation[]>(() => {
    if (accommodations.length > 0) return accommodations
    return Array.from({ length: tripDays }, (_, i) => ({
      dayIndex: i + 1,
      name: '',
      location: EMPTY_GEO,
    }))
  })

  function update(dayIndex: number, patch: Partial<Accommodation>) {
    setList((l) =>
      l.map((a) => (a.dayIndex === dayIndex ? { ...a, ...patch } : a))
    )
  }

  function next() {
    dispatch({ type: 'SET_ACCOMMODATIONS', accommodations: list })
    dispatch({ type: 'SET_STEP', step: 5 })
  }

  function back() {
    dispatch({ type: 'SET_ACCOMMODATIONS', accommodations: list })
    dispatch({ type: 'SET_STEP', step: 3 })
  }

  return (
    <div className="card step-enter max-w-2xl mx-auto space-y-5">
      <h2 className="section-title">住宿設定</h2>
      <p className="text-sm text-gray-500">住宿地點作為每天的強制起訖點，請填入每晚落腳處。</p>

      <div className="space-y-5">
        {list.map((accom) => (
          <div key={accom.dayIndex} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {accom.dayIndex}
              </div>
              <span className="font-medium text-sm text-gray-700">第 {accom.dayIndex} 天住宿</span>
            </div>

            <div>
              <label className="label">住宿名稱</label>
              <input
                className="input"
                value={accom.name}
                onChange={(e) => update(accom.dayIndex, { name: e.target.value })}
                placeholder="例：日月潭涵碧樓"
              />
            </div>

            <GeoInput
              label="住宿地點"
              value={accom.location}
              onChange={(loc) => update(accom.dayIndex, { location: loc })}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={back} className="btn-secondary">上一步</button>
        <button onClick={next} className="btn-primary">下一步</button>
      </div>
    </div>
  )
}
