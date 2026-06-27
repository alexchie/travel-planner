import { useState, useEffect } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
}

function parse(value: string) {
  if (!value) return { date: '', h: 8, m: 0 }
  const [date, time] = value.split('T')
  const [hStr, mStr] = (time ?? '08:00').split(':')
  return { date: date ?? '', h: parseInt(hStr ?? '8', 10), m: parseInt(mStr ?? '0', 10) }
}

function format(date: string, h: number, m: number) {
  if (!date) return ''
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function DateTimePicker24({ label, value, onChange }: Props) {
  const [date, setDate] = useState(() => parse(value).date)
  const [h, setH] = useState(() => parse(value).h)
  const [m, setM] = useState(() => parse(value).m)

  useEffect(() => {
    const parsed = parse(value)
    setDate(parsed.date)
    setH(parsed.h)
    setM(parsed.m)
  }, [value])

  function emit(newDate: string, newH: number, newM: number) {
    onChange(format(newDate, newH, newM))
  }

  function adjH(delta: number) {
    const next = (h + delta + 24) % 24
    setH(next)
    emit(date, next, m)
  }

  function adjM(delta: number) {
    let next = m + delta
    let hDelta = 0
    if (next >= 60) { next -= 60; hDelta = 1 }
    if (next < 0)  { next += 60; hDelta = -1 }
    const nextH = (h + hDelta + 24) % 24
    setH(nextH)
    setM(next)
    emit(date, nextH, next)
  }

  function handleDate(newDate: string) {
    setDate(newDate)
    emit(newDate, h, m)
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="date"
        className="input mb-2"
        value={date}
        onChange={(e) => handleDate(e.target.value)}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => adjH(-1)}
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-base leading-none"
        >−</button>
        <span className="w-8 text-center font-mono text-sm font-semibold">{pad(h)}</span>
        <button
          type="button"
          onClick={() => adjH(1)}
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-base leading-none"
        >+</button>
        <span className="mx-1 text-gray-500 font-mono">:</span>
        <button
          type="button"
          onClick={() => adjM(-15)}
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-base leading-none"
        >−</button>
        <span className="w-8 text-center font-mono text-sm font-semibold">{pad(m)}</span>
        <button
          type="button"
          onClick={() => adjM(15)}
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-base leading-none"
        >+</button>
        <span className="ml-2 text-xs text-gray-400">(每次 15 分鐘)</span>
      </div>
    </div>
  )
}
