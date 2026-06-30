import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useDispatch, useAppState } from '../../store'
import type { Restaurant, GeoPoint, MealType, MealAssignmentMode, DishType, Priority } from '../../types'
import { MEAL_TYPE_LABEL, SNACK_REQUIRED, defaultOpenHours } from '../../types'
import GeoInput from './GeoInput'
import OpenHoursEditor from './OpenHoursEditor'

const EMPTY_GEO: GeoPoint = { lat: 0, lng: 0, address: '' }

function emptyRestaurant(): Restaurant {
  return {
    id: uuidv4(),
    name: '',
    location: EMPTY_GEO,
    openHours: defaultOpenHours(),
    mealType: 'any',
    mealAssignmentMode: 'flexible',
    assignedDay: null,
    dishType: 'full_meal',
    priority: 'must',
  }
}

type SnackModal = { mealType: MealType; have: number; need: number } | null

export default function Step3Restaurants() {
  const { restaurants } = useAppState()
  const dispatch = useDispatch()
  const [list, setList] = useState<Restaurant[]>(
    restaurants.length > 0 ? restaurants : []
  )
  const [expanded, setExpanded] = useState<string | null>(null)
  const [snackModal, setSnackModal] = useState<SnackModal>(null)

  function add() {
    const r = emptyRestaurant()
    setList((l) => [...l, r])
    setExpanded(r.id)
  }

  function remove(id: string) {
    setList((l) => l.filter((r) => r.id !== id))
  }

  function update(id: string, patch: Partial<Restaurant>) {
    setList((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function checkSnackCounts(): SnackModal {
    const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'afternoon_tea', 'supper']
    for (const mt of mealTypes) {
      const required = SNACK_REQUIRED[mt]
      const fullMeals = list.filter((r) => r.mealType === mt && r.dishType === 'full_meal').length
      const snacks = list.filter((r) => r.mealType === mt && r.dishType === 'snack').length
      if (fullMeals === 0 && snacks > 0 && snacks < required) {
        return { mealType: mt, have: snacks, need: required - snacks }
      }
    }
    return null
  }

  function next() {
    const issue = checkSnackCounts()
    if (issue) {
      setSnackModal(issue)
      return
    }
    dispatch({ type: 'SET_RESTAURANTS', restaurants: list })
    dispatch({ type: 'SET_STEP', step: 4 })
  }

  function back() {
    dispatch({ type: 'SET_RESTAURANTS', restaurants: list })
    dispatch({ type: 'SET_STEP', step: 2 })
  }

  function dismissAndContinue() {
    setSnackModal(null)
    dispatch({ type: 'SET_RESTAURANTS', restaurants: list })
    dispatch({ type: 'SET_STEP', step: 4 })
  }

  return (
    <div className="card step-enter max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">餐廳清單</h2>
        <button onClick={add} className="btn-primary text-sm">
          + 新增餐廳
        </button>
      </div>

      {list.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          尚未新增餐廳（可選填）
        </div>
      )}

      <div className="space-y-3">
        {list.map((r) => (
          <div key={r.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400">{expanded === r.id ? '▼' : '▶'}</span>
                <span className="font-medium text-sm">{r.name || '（未命名）'}</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {MEAL_TYPE_LABEL[r.mealType]}
                </span>
                {r.dishType === 'snack' && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    小吃
                  </span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(r.id) }}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {expanded === r.id && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100 bg-gray-50">
                <div className="pt-4">
                  <GeoInput
                    label="餐廳名稱（輸入即自動搜尋地址）"
                    value={r.location}
                    onChange={(loc) => update(r.id, { location: loc })}
                    onOpenHours={(hours) => update(r.id, { openHours: hours })}
                    nameValue={r.name}
                    onNameChange={(name) => update(r.id, { name })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">餐別</label>
                    <select
                      className="input"
                      value={r.mealType}
                      onChange={(e) => update(r.id, { mealType: e.target.value as MealType })}
                    >
                      {(Object.entries(MEAL_TYPE_LABEL) as [MealType, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">類型</label>
                    <select
                      className="input"
                      value={r.dishType}
                      onChange={(e) => update(r.id, { dishType: e.target.value as DishType })}
                    >
                      <option value="full_meal">正餐</option>
                      <option value="snack">小吃</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">指定模式</label>
                  <div className="space-y-1.5">
                    {([
                      ['fixed_day', '指定第N天'],
                      ['fixed_meal_only', '僅指定餐別'],
                      ['flexible', '不指定'],
                    ] as [MealAssignmentMode, string][]).map(([k, v]) => (
                      <label key={k} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          checked={r.mealAssignmentMode === k}
                          onChange={() => update(r.id, { mealAssignmentMode: k, assignedDay: null })}
                          className="accent-blue-600"
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                  {r.mealAssignmentMode === 'fixed_day' && (
                    <div className="mt-2 ml-6">
                      <label className="label">第幾天</label>
                      <input
                        type="number"
                        min={1}
                        className="input w-24"
                        value={r.assignedDay ?? ''}
                        onChange={(e) => update(r.id, { assignedDay: Number(e.target.value) })}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">優先級</label>
                  <div className="flex gap-4">
                    {(['must', 'flexible'] as Priority[]).map((p) => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          checked={r.priority === p}
                          onChange={() => update(r.id, { priority: p })}
                          className="accent-blue-600"
                        />
                        {p === 'must' ? '必去' : '彈性'}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="text-sm">
                  <p className="font-medium text-gray-700 mb-2">營業時間設定</p>
                  <OpenHoursEditor
                    value={r.openHours}
                    onChange={(h) => update(r.id, { openHours: h })}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={back} className="btn-secondary">上一步</button>
        <button onClick={next} className="btn-primary">下一步</button>
      </div>

      {snackModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 space-y-4">
            <h3 className="font-bold text-gray-900">小吃數量不足</h3>
            <p className="text-sm text-gray-600">
              {MEAL_TYPE_LABEL[snackModal.mealType]}的小吃目前只有 {snackModal.have} 家，
              依規則需要 {SNACK_REQUIRED[snackModal.mealType]} 家才能湊成一餐。
              還缺 {snackModal.need} 家。
            </p>
            <p className="text-sm text-gray-500">請選擇處理方式：</p>
            <div className="space-y-2">
              <button
                onClick={() => setSnackModal(null)}
                className="w-full btn-secondary text-sm"
              >
                回去補填小吃
              </button>
              <button
                onClick={dismissAndContinue}
                className="w-full btn-secondary text-sm"
              >
                先留空，之後再補
              </button>
              <button
                onClick={dismissAndContinue}
                className="w-full btn-primary text-sm"
              >
                繼續（讓系統自動補齊）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
