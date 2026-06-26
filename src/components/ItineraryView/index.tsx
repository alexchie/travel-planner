import { useState } from 'react'
import { useAppState, useDispatch } from '../../store'
import { reorderDay } from '../../optimizer'
import DayView from './DayView'

export default function ItineraryView() {
  const state = useAppState()
  const dispatch = useDispatch()
  const { originalItinerary, editedItinerary, isEditing, trip } = state

  const [activeDay, setActiveDay] = useState(1)

  const itinerary = isEditing ? editedItinerary : originalItinerary
  if (!itinerary || !trip) return null

  function handleReorder(dayIndex: number, fromIdx: number, toIdx: number) {
    if (!editedItinerary) return
    const updated = reorderDay(editedItinerary, dayIndex, fromIdx, toIdx, trip!.transportMode)
    dispatch({ type: 'UPDATE_EDITED', itinerary: updated })
  }

  function enterEdit() {
    dispatch({ type: 'ENTER_EDIT' })
  }

  function exitEdit() {
    dispatch({ type: 'EXIT_EDIT' })
  }

  function resetEdit() {
    dispatch({ type: 'RESET_EDIT' })
  }

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
          拖曳景點/餐廳調整順序，住宿點無法移動。若違反營業時間將顯示警告，但不強制阻擋。
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
    </div>
  )
}
