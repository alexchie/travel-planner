import type { OpenHours } from '../../types'
import { DAY_KEYS, DAY_LABELS } from '../../types'

interface Props {
  value: OpenHours
  onChange: (v: OpenHours) => void
}

export default function OpenHoursEditor({ value, onChange }: Props) {
  function toggle(day: string, checked: boolean) {
    onChange({
      ...value,
      [day]: checked ? { open: '09:00', close: '18:00' } : null,
    })
  }

  function update(day: string, field: 'open' | 'close', val: string) {
    const existing = value[day as keyof OpenHours]
    if (!existing) return
    onChange({ ...value, [day]: { ...existing, [field]: val } })
  }

  return (
    <div className="space-y-1.5">
      {DAY_KEYS.map((day) => {
        const hours = value[day]
        return (
          <div key={day} className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 w-14 cursor-pointer">
              <input
                type="checkbox"
                checked={!!hours}
                onChange={(e) => toggle(day, e.target.checked)}
                className="accent-blue-600"
              />
              <span className="text-gray-700">週{DAY_LABELS[day]}</span>
            </label>
            {hours ? (
              <>
                <input
                  type="time"
                  className="input w-28 py-1"
                  value={hours.open}
                  onChange={(e) => update(day, 'open', e.target.value)}
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  className="input w-28 py-1"
                  value={hours.close}
                  onChange={(e) => update(day, 'close', e.target.value)}
                />
              </>
            ) : (
              <span className="text-gray-400 text-xs">休息</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
