import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAppState, useDispatch } from '../../store'
import { reorderDay } from '../../optimizer'
import type { Stop, GeoPoint, MealType, OpenHours } from '../../types'
import { MEAL_TYPE_LABEL } from '../../types'
import { exportItineraryCSV, openDayInGoogleMaps } from '../../lib/export'
import DayView from './DayView'
import GeoInput from '../MultiStepForm/GeoInput'

const EMPTY_GEO: GeoPoint = { lat: 0, lng: 0, address: '' }

interface NewPlaceForm {
  name: string
  type: 'attraction' | 'restaurant'
  location: GeoPoint
  durationMinutes: number
  mealType: MealType
}

function emptyForm(): NewPlaceForm {
  return { name: '', type: 'attraction', location: EMPTY_GEO, durationMinutes: 60, mealType: 'any' }
}

export default function ItineraryView() {
  const state = useAppState()
  const dispatch = useDispatch()
  const { originalItinerary, editedItinerary, isEditing, trip, attractions, restaurants } = state

  const [activeDay, setActiveDay] = useState(1)
  const [addModal, setAddModal] = useState(false)
  const [addTab, setAddTab] = useState<'list' | 'new'>('list')
  const [newForm, setNewForm] = useState<NewPlaceForm>(emptyForm)

  const itinerary = isEditing ? editedItinerary : originalItinerary
  if (!itinerary || !trip) return null

  const openHoursMap: Record<string, OpenHours> = {}
  for (const a of attractions) openHoursMap[a.name.trim()] = a.openHours
  for (const r of restaurants) openHoursMap[r.name.trim()] = r.openHours

  const allStopNames = new Set(
    itinerary.flatMap((d) => d.stops.map((s) => s.name.trim().toLowerCase()))
  )
  const missingMust = [
    ...attractions.filter((a) => a.priority === 'must' && !allStopNames.has(a.name.trim().toLowerCase())),
    ...restaurants.filter((r) => r.priority === 'must' && !allStopNames.has(r.name.trim().toLowerCase())),
  ]
  const unscheduledAttractions = attractions.filter(
    (a) => !allStopNames.has(a.name.trim().toLowerCase())
  )
  const unscheduledRestaurants = restaurants.filter(
    (r) => !allStopNames.has(r.name.trim().toLowerCase())
  )
  const hasSidebar = unscheduledAttractions.length > 0 || unscheduledRestaurants.length > 0

  function handleReorder(dayIndex: number, fromIdx: number, toIdx: number) {
    if (!editedItinerary) return
    const updated = reorderDay(editedItinerary, dayIndex, fromIdx, toIdx, trip!.transportMode)
    dispatch({ type: 'UPDATE_EDITED', itinerary: updated })
  }

  function handleRemoveStop(stopId: string) {
    dispatch({ type: 'REMOVE_STOP', dayIndex: activeDay, stopId })
  }

  function addStop(stop: Stop) {
    dispatch({ type: 'ADD_STOP', dayIndex: activeDay, stop })
    setAddModal(false)
    setNewForm(emptyForm())
  }

  function addFromExisting(
    item: { id: string; name: string; location: GeoPoint; durationMinutes?: number; mealType?: MealType },
    type: 'attraction' | 'restaurant'
  ) {
    const dur = item.durationMinutes ?? 60
    const arrival = '12:00'
    const [h, m] = arrival.split(':').map(Number)
    const depMin = h * 60 + m + dur
    const dep = `${String(Math.floor(depMin / 60)).padStart(2, '0')}:${String(depMin % 60).padStart(2, '0')}`
    addStop({
      id: uuidv4(),
      type,
      name: item.name,
      location: item.location,
      arrivalTime: arrival,
      departureTime: dep,
      durationMinutes: dur,
      travelTimeToNext: 0,
      hasWarning: false,
      mealType: type === 'restaurant' ? item.mealType : undefined,
    })
  }

  function addNewPlace() {
    if (!newForm.name || newForm.location.lat === 0) return
    const dur = newForm.durationMinutes
    const arrival = '12:00'
    const [h, m] = arrival.split(':').map(Number)
    const depMin = h * 60 + m + dur
    const dep = `${String(Math.floor(depMin / 60)).padStart(2, '0')}:${String(depMin % 60).padStart(2, '0')}`
    addStop({
      id: uuidv4(),
      type: newForm.type,
      name: newForm.name,
      location: newForm.location,
      arrivalTime: arrival,
      departureTime: dep,
      durationMinutes: dur,
      travelTimeToNext: 0,
      hasWarning: false,
      mealType: newForm.type === 'restaurant' ? newForm.mealType : undefined,
    })
  }

  function enterEdit() { dispatch({ type: 'ENTER_EDIT' }) }
  function saveEdit() { dispatch({ type: 'SAVE_EDIT' }) }
  function discardEdit() { dispatch({ type: 'EXIT_EDIT' }) }
  function resetEdit() { dispatch({ type: 'RESET_EDIT' }) }

  const currentDay = itinerary.find((d) => d.dayIndex === activeDay)

  return (
    <div className="space-y-4 fade-in">
      {state.aiError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          AI 規劃失敗，已改用本地演算法。原因：{state.aiError}
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">行程規劃結果</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {itinerary.length} 天 · {itinerary.reduce((s, d) => s + d.stops.filter((st) => st.type !== 'accommodation').length, 0)} 個地點
            {isEditing && <span className="ml-2 badge-blue">編輯模式</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {isEditing ? (
            <>
              <button onClick={resetEdit} className="btn-secondary">還原</button>
              <button onClick={discardEdit} className="btn-secondary">取消</button>
              <button onClick={saveEdit} className="btn-primary">儲存</button>
            </>
          ) : (
            <>
              <button onClick={enterEdit} className="btn-secondary">編輯行程</button>
              <button onClick={() => dispatch({ type: 'GO_TO_FORM' })} className="btn-secondary">重新規劃</button>
            </>
          )}
        </div>
      </div>

      {/* Export toolbar — visible outside edit mode */}
      {!isEditing && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => exportItineraryCSV(itinerary)}
            className="btn-secondary text-sm"
          >
            ⇩ 包入 Google Sheets（CSV）
          </button>
          {currentDay && (
            <button
              onClick={() => openDayInGoogleMaps(currentDay, trip.transportMode)}
              className="btn-secondary text-sm"
            >
              ↗︎ Google Maps 第 {activeDay} 天路線
            </button>
          )}
        </div>
      )}

      {isEditing && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm text-blue-700">
          拖曳調整順序 · 點 × 刪除 · 點「+ 新增地點」加入
        </div>
      )}

      {missingMust.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-red-700 mb-2">以下必要地點未被排入行程：</p>
          <div className="flex flex-wrap gap-2">
            {missingMust.map((item) => (
              <span key={item.id} className="badge-red">
                {'mealType' in item
                  ? `${item.name}（${MEAL_TYPE_LABEL[(item as typeof restaurants[0]).mealType]}）`
                  : item.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-red-400 mt-2">可能因營業時間衝突或排不下，請檢查結果。</p>
        </div>
      )}

      {/* Two-column layout: main itinerary + sidebar */}
      <div className="flex gap-5 items-start">

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {itinerary.map((day) => (
              <button
                key={day.dayIndex}
                onClick={() => setActiveDay(day.dayIndex)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  activeDay === day.dayIndex
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <div>第 {day.dayIndex} 天</div>
                <div className={`text-[10px] font-normal mt-0.5 ${activeDay === day.dayIndex ? 'text-blue-100' : 'text-slate-400'}`}>
                  {day.date}
                </div>
              </button>
            ))}
          </div>

          {currentDay && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">
                  第 {currentDay.dayIndex} 天 · {currentDay.date}
                </h3>
                <span className="badge-gray">
                  {currentDay.stops.filter((s) => s.type !== 'accommodation').length} 個地點
                </span>
              </div>
              <DayView
                day={currentDay}
                dayIdx={currentDay.dayIndex - 1}
                isEditing={isEditing}
                onReorder={(from, to) => handleReorder(currentDay.dayIndex, from, to)}
                onAddStop={isEditing ? () => { setAddTab('list'); setAddModal(true) } : undefined}
                onRemoveStop={isEditing ? handleRemoveStop : undefined}
                openHoursMap={openHoursMap}
              />
            </div>
          )}

          <div className="card bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">總覽</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xl font-bold text-blue-600">{itinerary.length}</div>
                <div className="text-xs text-gray-500">天數</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-600">
                  {itinerary.reduce((s, d) => s + d.stops.filter((st) => st.type !== 'accommodation').length, 0)}
                </div>
                <div className="text-xs text-gray-500">地點</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-600">
                  {Math.round(itinerary.reduce((s, d) => s + d.totalTravelMinutes, 0) / 60 * 10) / 10}h
                </div>
                <div className="text-xs text-gray-500">總交通時間</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: unscheduled items */}
        {hasSidebar && (
          <div className="w-56 flex-shrink-0 sticky top-4 space-y-2">
            <div className="card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">未排入行程</h3>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {unscheduledAttractions.length + unscheduledRestaurants.length}
                </span>
              </div>

              {isEditing && (
                <p className="text-xs text-gray-400">點 + 加入第 {activeDay} 天</p>
              )}

              {unscheduledAttractions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">景點</p>
                  <div className="space-y-1.5">
                    {unscheduledAttractions.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-2 px-2 py-2 rounded-lg bg-gray-50 border border-gray-100"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 leading-tight">{a.name || '（未命名）'}</span>
                            {a.priority === 'must' && (
                              <span className="text-xs bg-red-100 text-red-600 px-1 py-0.5 rounded leading-none flex-shrink-0">必去</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">{a.durationMinutes} 分鐘</span>
                        </div>
                        {isEditing && (
                          <button
                            onClick={() => addFromExisting(a, 'attraction')}
                            title={`加入第 ${activeDay} 天`}
                            className="text-blue-500 hover:text-blue-700 text-xl leading-none flex-shrink-0 mt-0.5 font-light"
                          >
                            +
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unscheduledRestaurants.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">餐廳</p>
                  <div className="space-y-1.5">
                    {unscheduledRestaurants.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start justify-between gap-2 px-2 py-2 rounded-lg bg-gray-50 border border-gray-100"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 leading-tight">{r.name || '（未命名）'}</span>
                            {r.priority === 'must' && (
                              <span className="text-xs bg-red-100 text-red-600 px-1 py-0.5 rounded leading-none flex-shrink-0">必去</span>
                            )}
                          </div>
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            {MEAL_TYPE_LABEL[r.mealType]}
                          </span>
                        </div>
                        {isEditing && (
                          <button
                            onClick={() => addFromExisting(
                              { ...r, durationMinutes: r.dishType === 'snack' ? 30 : 60 },
                              'restaurant'
                            )}
                            title={`加入第 ${activeDay} 天`}
                            className="text-blue-500 hover:text-blue-700 text-xl leading-none flex-shrink-0 mt-0.5 font-light"
                          >
                            +
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add stop modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-bold text-gray-900">新增地點 — 第 {activeDay} 天</h3>
              <button
                onClick={() => { setAddModal(false); setNewForm(emptyForm()) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex border-b">
              <button
                onClick={() => setAddTab('list')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  addTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                從清單選擇
              </button>
              <button
                onClick={() => setAddTab('new')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  addTab === 'new' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                搜尋新地點
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {addTab === 'list' && (
                <div className="space-y-2">
                  {attractions.length === 0 && restaurants.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">尚無景點或餐廳資料</p>
                  )}
                  {attractions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">景點</p>
                      <div className="space-y-1">
                        {attractions.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => addFromExisting(a, 'attraction')}
                            className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm text-gray-800">{a.name || '（未命名）'}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">{a.durationMinutes} 分鐘</span>
                            </div>
                            {a.location.address && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{a.location.address}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {restaurants.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">餐廳</p>
                      <div className="space-y-1">
                        {restaurants.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => addFromExisting(
                              { ...r, durationMinutes: r.dishType === 'snack' ? 30 : 60 },
                              'restaurant'
                            )}
                            className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-100 hover:border-amber-200 hover:bg-amber-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm text-gray-800">{r.name || '（未命名）'}</span>
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">
                                {MEAL_TYPE_LABEL[r.mealType]}
                              </span>
                            </div>
                            {r.location.address && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{r.location.address}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {addTab === 'new' && (
                <div className="space-y-4">
                  <div>
                    <label className="label">地點名稱</label>
                    <input
                      className="input"
                      value={newForm.name}
                      onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="例：九份老街"
                    />
                  </div>
                  <GeoInput
                    label="地址／搜尋"
                    value={newForm.location}
                    onChange={(loc) => setNewForm((f) => ({ ...f, location: loc }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">類型</label>
                      <select
                        className="input"
                        value={newForm.type}
                        onChange={(e) => setNewForm((f) => ({ ...f, type: e.target.value as 'attraction' | 'restaurant' }))}
                      >
                        <option value="attraction">景點</option>
                        <option value="restaurant">餐廳</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">停留時間（分鐘）</label>
                      <input
                        type="number"
                        min={15}
                        step={15}
                        className="input"
                        value={newForm.durationMinutes}
                        onChange={(e) => setNewForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  {newForm.type === 'restaurant' && (
                    <div>
                      <label className="label">餐別</label>
                      <select
                        className="input"
                        value={newForm.mealType}
                        onChange={(e) => setNewForm((f) => ({ ...f, mealType: e.target.value as MealType }))}
                      >
                        {(Object.entries(MEAL_TYPE_LABEL) as [MealType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={addNewPlace}
                    disabled={!newForm.name || newForm.location.lat === 0}
                    className="w-full btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    加入第 {activeDay} 天行程
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
