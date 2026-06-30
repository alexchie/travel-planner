import { useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
}

export default function TimeInput24({ value, onChange, className = '' }: Props) {
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value])

  function commit(raw: string) {
    const cleaned = raw.trim().replace(/[^0-9:]/g, '')
    const m = cleaned.match(/^(\d{1,2}):(\d{2})$/)
    if (m) {
      const h = Math.min(23, parseInt(m[1], 10))
      const min = Math.min(59, parseInt(m[2], 10))
      const formatted = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      setDraft(formatted)
      onChange(formatted)
    } else {
      setDraft(value)
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      maxLength={5}
      className={`font-mono ${className}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(draft) }}
    />
  )
}
