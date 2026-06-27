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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function DateTimePicker24({ label, value, onChange }: Props) {
  const [date, setDate] = useState(() => parse(value).date)
  const [h, setH] = useState(() => parse(value).h)
  const [m, setM] = useState(() => parse(value).m)
  const [hInput, setHInput] = useState(() => String(parse(value).h).padStart(2, '0'))
  const [mInput, setMInput] = useState(() => String(parse(value).m).padStart(2, '0'))

  useEffect(() => {
    const parsed = parse(value)
    setDate(parsed.date)
    setH(parsed.h)
    setM(parsed.m)
    setHInput(String(parsed.h).padStart(2, '0'))
    setMInput(String(parsed.m).padStart(2, '0'))
  }, [value])

  function emit(newDate: string, newH: number, newM: number) {
    onChange(format(newDate, newH, newM))
  }

  function adjH(delta: number) {
    const next = (h + delta + 24) % 24
    setH(next)
    setHInput(String(next).padStart(2, '0'))
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
    setHInput(String(nextH).padStart(2, '0'))
    setMInput(String(next).padStart(2, '0'))
    emit(date, nextH, next)
  }

  function handleDate(newDate: string) {
    setDate(newDate)
    emit(newDate, h, m)
  }

  function commitH(raw: string) {
    const n = clamp(parseInt(raw, 10) || 0, 0, 23)
    setH(n)
    setHInput(String(n).padStart(2, '0'))
    emit(date, n, m)
  }

  function commitM(raw: string) {
    const n = clamp(parseInt(raw, 10) || 0, 0, 59)
    setM(n)
    setMInput(String(n).padStart(2, '0'))
    emit(date, h, n)
  }

  const btnCls = 'w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-base leading-none'
  const numCls = 'w-9 text-center font-mono text-sm font-semibold border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500'

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
        <button type="button" onClick={() => adjH(-1)} className={btnCls}>−</button>
        <input
          type="text"
          inputMode="numeric"
          className={numCls}
          value={hInput}
          onChange={(e) => setHInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onBlur={(e) => commitH(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitH(hInput)}
        />
        <button type="button" onClick={() => adjH(1)} className={btnCls}>+</button>
        <span className="mx-1 text-gray-500 font-mono">:</span>
        <button type="button" onClick={() => adjM(-5)} className={btnCls}>−</button>
        <input
          type="text"
          inputMode="numeric"
          className={numCls}
          value={mInput}
          onChange={(e) => setMInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onBlur={(e) => commitM(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitM(mInput)}
        />
        <button type="button" onClick={() => adjM(5)} className={btnCls}>+</button>
      </div>
    </div>
  )
}
