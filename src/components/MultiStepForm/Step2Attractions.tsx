import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useDispatch, useAppState } from '../../store'
import type { Attraction, GeoPoint, Priority } from '../../types'
import { defaultOpenHours } from '../../types'
import GeoInput from './GeoInput'
import OpenHoursEditor from './OpenHoursEditor'

const EMPTY_GEO: GeoPoint = { lat: 0, lng: 0, address: '' }

function emptyAttraction(): Attraction {
  return {
    id: uuidv4(),
    name: '',
    location: EMPTY_GEO,
    openHours: defaultOpenHours(),
    durationMinutes: 60,
    priority: 'flexible',
    timeWindowRequired: null,
  }
}

export default function Step2Attractions() {
  const { attractions } = useAppState()
  const dispatch = useDispatch()
  const [list, setList] = useState<Attraction[]>(
    attractions.length > 0 ? attractions : []
  )
  const [expanded, setExpanded] = useState<string | null>(null)

  function add() {
    const a = emptyAttraction()
    setList((l) => [...l, a])
    setExpanded(a.id)
  }

  function remove(id: string) {
    setList((l) => l.filter((a) => a.id !== id))
  }

  function update(id: string, patch: Partial<Attraction>) {
    setList((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  function next() {
    dispatch({ type: 'SET_ATTRACTIONS', attractions: list })
    dispatch({ type: 'SET_STEP', step: 3 })
  }

  function back() {
    dispatch({ type: 'SET_ATTRACTIONS', attractions: list })
    dispatch({ type: 'SET_STEP', step: 1 })
  }

  return (
    <div className="card step-enter max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">景點清單</h2>
        <button onClick={add} className="btn-primary text-sm">
          + 新增景點
        </button>
      </div>

      {list.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          尚未新增景點，點擊上方按鈕新增
        </div>
      )}

      <div className="space-y-3">
        {list.map((attr) => (
          <div key={attr.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(expanded === attr.id ? null : attr.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400">
                  {expanded === attr.id ? '▼' : '▶'}
                </span>
                <span className="font-medium text-sm">
                  {attr.name || '（未命名景點）'}
                </span>
                {attr.priority === 'must' && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    必去
                  </span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(attr.id) }}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {expanded === attr.id && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100 bg-gray-50">
                <div className="pt-4">
                  <label className="label">景點名稱</label>
                  <input
                    className="input"
                    value={attr.name}
                    onChange={(e) => update(attr.id, { name: e.target.value })}
                    placeholder="例：日月潭"
                  />
                </div>

                <GeoInput
                  label="地點"
                  value={attr.location}
                  onChange={(loc) => update(attr.id, { location: loc })}
                />

                <div>
                  <label className="label">
                    預估停留時間：<strong>{attr.durationMinutes} 分鐘</strong>
                  </label>
                  <input
                    type="range"
                    min={30}
                    max={300}
                    step={15}
                    value={attr.durationMinutes}
                    onChange={(e) => update(attr.id, { durationMinutes: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>30 分</span>
                    <span>5 小時</span>
                  </div>
                </div>

                <div>
                  <label className="label">優先級</label>
                  <div className="flex gap-4">
                    {(['must', 'flexible'] as Priority[]).map((p) => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          checked={attr.priority === p}
                          onChange={() => update(attr.id, { priority: p })}
                          className="accent-blue-600"
                        />
                        {p === 'must' ? '必去' : '彈性'}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={!!attr.timeWindowRequired}
                      onChange={(e) =>
                        update(attr.id, {
                          timeWindowRequired: e.target.checked
                            ? { date: '', startTime: '09:00', endTime: '11:00' }
                            : null,
                        })
                      }
                      className="accent-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">指定特定時段</span>
                  </label>
                  {attr.timeWindowRequired && (
                    <div className="grid grid-cols-3 gap-2 ml-6">
                      <div>
                        <label className="label">日期</label>
                        <input
                          type="date"
                          className="input"
                          value={attr.timeWindowRequired.date}
                          onChange={(e) =>
                            update(attr.id, {
                              timeWindowRequired: {
                                ...attr.timeWindowRequired!,
                                date: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="label">開始</label>
                        <input
                          type="time"
                          className="input"
                          value={attr.timeWindowRequired.startTime}
                          onChange={(e) =>
                            update(attr.id, {
                              timeWindowRequired: {
                                ...attr.timeWindowRequired!,
                                startTime: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="label">結束</label>
                        <input
                          type="time"
                          className="input"
                          value={attr.timeWindowRequired.endTime}
                          onChange={(e) =>
                            update(attr.id, {
                              timeWindowRequired: {
                                ...attr.timeWindowRequired!,
                                endTime: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
                    營業時間設定
                  </summary>
                  <div className="mt-2">
                    <OpenHoursEditor
                      value={attr.openHours}
                      onChange={(h) => update(attr.id, { openHours: h })}
                    />
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={back} className="btn-secondary">
          上一步
        </button>
        <button onClick={next} className="btn-primary">
          下一步
        </button>
      </div>
    </div>
  )
}
