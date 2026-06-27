import { useState } from 'react'
import { useDispatch, useAppState } from '../../store'
import type { TripInfo, GeoPoint, TransportMode } from '../../types'
import { TRANSPORT_LABEL } from '../../types'
import GeoInput from './GeoInput'
import DateTimePicker24 from './DateTimePicker24'

const EMPTY_GEO: GeoPoint = { lat: 0, lng: 0, address: '' }

export default function Step1TripInfo() {
  const { trip } = useAppState()
  const dispatch = useDispatch()
  const [form, setForm] = useState<TripInfo>(
    trip ?? {
      arrivalDatetime: '',
      departureDatetime: '',
      startLocation: EMPTY_GEO,
      endLocation: EMPTY_GEO,
      transportMode: 'car',
    }
  )
  const [sameAsStart, setSameAsStart] = useState(false)

  function isValid() {
    return (
      form.arrivalDatetime &&
      form.departureDatetime &&
      form.startLocation.lat !== 0 &&
      form.endLocation.lat !== 0 &&
      form.arrivalDatetime <= form.departureDatetime
    )
  }

  function next() {
    dispatch({ type: 'SET_TRIP', trip: form })
    dispatch({ type: 'SET_STEP', step: 2 })
  }

  return (
    <div className="card step-enter space-y-5 max-w-2xl mx-auto">
      <h2 className="section-title">行程基本資訊</h2>
      <div className="grid grid-cols-2 gap-4">
        <DateTimePicker24
          label="抵達時間"
          value={form.arrivalDatetime}
          onChange={(v) => setForm((f) => ({ ...f, arrivalDatetime: v }))}
        />
        <DateTimePicker24
          label="離開時間"
          value={form.departureDatetime}
          onChange={(v) => setForm((f) => ({ ...f, departureDatetime: v }))}
        />
      </div>
      {form.arrivalDatetime && form.departureDatetime && form.arrivalDatetime > form.departureDatetime && (
        <p className="text-sm text-red-500">離開時間必須晩於抵達時間</p>
      )}
      <div>
        <label className="label">交通方式</label>
        <div className="flex flex-wrap gap-3">
          {(Object.entries(TRANSPORT_LABEL) as [TransportMode, string][]).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transport"
                value={k}
                checked={form.transportMode === k}
                onChange={() => setForm((f) => ({ ...f, transportMode: k }))}
                className="accent-blue-600"
              />
              <span className="text-sm">{v}</span>
            </label>
          ))}
        </div>
      </div>
      <GeoInput label="行程起點" value={form.startLocation} onChange={(loc) => setForm((f) => ({ ...f, startLocation: loc, ...(sameAsStart ? { endLocation: loc } : {}) }))} />
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">行程終點</label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={sameAsStart} onChange={(e) => { setSameAsStart(e.target.checked); if (e.target.checked) setForm((f) => ({ ...f, endLocation: f.startLocation })) }} className="accent-blue-600" />
            與起點相同
          </label>
        </div>
        {!sameAsStart && <GeoInput label="" value={form.endLocation} onChange={(loc) => setForm((f) => ({ ...f, endLocation: loc }))} />}
      </div>
      <div className="flex justify-end">
        <button onClick={next} disabled={!isValid()} className="btn-primary">下一步</button>
      </div>
    </div>
  )
}
