import { useState } from 'react'
import { useDispatch, useAppState } from '../../store'
import type { Accommodation, GeoPoint } from '../../types'
import GeoInput from './GeoInput'

const EMPTY_GEO: GeoPoint = { lat: 0, lng: 0, address: '' }

function getDateForNight(arrivalDate: string, dayIndex: number): string {
  const d = new Date(arrivalDate)
  d.setDate(d.getDate() + dayIndex - 1)
  return d.toISOString().slice(0, 10)
}

function getNextDate(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function fmtDate(dateStr: string): string {
  const [y, m, day] = dateStr.split('-')
  return `${y}/${m}/${day}`
}

function fmtMD(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

export default function Step4Accommodation() {
  const { accommodations, trip } = useAppState()
  const dispatch = useDispatch()

  const arrivalDate = trip?.arrivalDatetime.slice(0, 10) ?? ''

  const tripDays = trip
    ? Math.round(
        (new Date(trip.departureDatetime.slice(0, 10)).getTime() -
          new Date(trip.arrivalDatetime.slice(0, 10)).getTime()) /
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
      <p className="text-sm text-gray-500">共 {tripDays} 晚。每晚住宿為當天的終點，也是隔天的起點，22:30 前抵達。</p>

      <div className="space-y-5">
        {list.map((accom) => {
          const nightDate = arrivalDate ? getDateForNight(arrivalDate, accom.dayIndex) : ''
          const nextDay = nightDate ? getNextDate(nightDate) : ''
          return (
            <div key={accom.dayIndex} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {accom.dayIndex}
                  </div>
                  <span className="font-semibold text-sm text-gray-800">
                    {nightDate ? fmtDate(nightDate) : `第 ${accom.dayIndex} 天`} 晚上住宿
                  </span>
                </div>
                {nightDate && nextDay && (
                  <p className="text-xs text-gray-400 ml-9">
                    {fmtMD(nightDate)} 當天終點 · {fmtMD(nextDay)} 出發點
                  </p>
                )}
              </div>

              <GeoInput
                label="住宿名稱（輸入即自動搜尋地址）"
                value={accom.location}
                onChange={(loc) => update(accom.dayIndex, { location: loc })}
                nameValue={accom.name}
                onNameChange={(name) => update(accom.dayIndex, { name })}
              />
            </div>
          )
        })}
      </div>

      <div className="flex justify-between">
        <button onClick={back} className="btn-secondary">上一步</button>
        <button onClick={next} className="btn-primary">下一步</button>
      </div>
    </div>
  )
}
