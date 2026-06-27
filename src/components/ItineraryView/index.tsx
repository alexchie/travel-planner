import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAppState, useDispatch } from '../../store'
import { reorderDay } from '../../optimizer'
import type { Stop, GeoPoint, MealType } from '../../types'
import { MEAL_TYPE_LABEL } from '../../types'
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

  function addFromExisting(item: { id: string; name: string; location: GeoPoint; durationMinutes?: number; mealType?: MealType }, type: 'attraction' | 'restaurant') {
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
  function exitEdit() { dispatch({ type: 'EXIT_EDIT' }) }
  function resetEdit() { dispatch({ type: 'RESET_EDIT' }) }

  const currentDay = itinerary.find((d) => d.dayIndex === activeDay)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">最佳行程</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEditing ? '編輯模式（副本）' : '系統規劃原始版本'}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={resetEdit} className="btn-secondary text-sm">
                還原原始版本
              </button>
              <button onClick={exitEdit} className="btn-secondary text-sm">
                結束編輯
              </button>
            </>
          ) : (
            <button onClick={enterEdit} className="btn-primary text-sm">
              編輯行程
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'GO_TO_FORM' })}
            className="btn-secondary text-sm"
          >
            重新規劃
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          拖曳景點/餐廳調整順序，點 × 可刪除，點「+ 新增地點」可加入地點。住宿點無法移動。
        </div>
      )}

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {itinerary.map((day) => (
          <button
            key={day.dayIndex}
            onClick={() => setActiveDay(day.dayIndex)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeDay === day.dayIndex
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div>第 {day.dayIndex} 天</div>
            <div className={`text-xs ${activeDay === day.dayIndex ? 'text-blue-100' : 'text-gray-400'}`}>
              {day.date}
            </div>
          </button>
        ))}
      </div>

      {/* Active day content */}
      {currentDay && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              第 {currentDay.dayIndex} 天 · {currentDay.date}
            </h3>
            <span className="text-xs text-gray-400">
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
          />
        </div>
      )}

      {/* Summary */}
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

      {/* Add Stop Modal */}
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
                            onClick={() => addFromExisting({ ...r, durationMinutes: r.dishType === 'snack' ? 30 : 60 }, 'restaurant')}
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
