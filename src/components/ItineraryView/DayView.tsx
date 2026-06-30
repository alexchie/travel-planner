import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DayItinerary, Stop, OpenHours } from '../../types'
import { MEAL_TYPE_LABEL } from '../../types'
import MapView from '../MapView'

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DOW_ZH = ['日', '一', '二', '三', '四', '五', '六']

const TYPE_COLOR: Record<string, string> = {
  attraction: 'bg-blue-500',
  restaurant: 'bg-amber-500',
  accommodation: 'bg-gray-500',
}

const TYPE_LABEL: Record<string, string> = {
  attraction: '景點',
  restaurant: '餐廳',
  accommodation: '住宿',
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function computeHoursConflict(
  stop: Stop,
  date: string,
  openHoursMap: Record<string, OpenHours>
): { todayHours: { open: string; close: string } | null | undefined; conflictMsg: string | null } {
  if (stop.type === 'accommodation') return { todayHours: undefined, conflictMsg: null }

  const oh = openHoursMap[stop.name.trim()]
  if (!oh) return { todayHours: undefined, conflictMsg: null }

  const dowIdx = new Date(date).getDay()
  const dayKey = DOW_KEYS[dowIdx]
  const dh = oh[dayKey] ?? null

  if (dh === null) {
    return { todayHours: null, conflictMsg: `週${DOW_ZH[dowIdx]} 公休` }
  }

  const arrival = toMin(stop.arrivalTime)
  const departure = toMin(stop.departureTime)
  const open = toMin(dh.open)
  const close = toMin(dh.close)
  if (arrival < open || departure > close) {
    return {
      todayHours: dh,
      conflictMsg: `規劃 ${stop.arrivalTime}–${stop.departureTime} 超出營業 ${dh.open}–${dh.close}`,
    }
  }

  return { todayHours: dh, conflictMsg: null }
}

function StopCard({
  stop,
  index,
  isEditing,
  onRemove,
  date,
  openHoursMap,
}: {
  stop: Stop
  index: number
  isEditing: boolean
  onRemove?: () => void
  date: string
  openHoursMap: Record<string, OpenHours>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
    disabled: !isEditing || stop.type === 'accommodation',
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const { todayHours, conflictMsg } = computeHoursConflict(stop, date, openHoursMap)
  const hasOpenHoursData = todayHours !== undefined
  const hasConflict = conflictMsg !== null
  const showFallbackWarning = !hasOpenHoursData && stop.hasWarning && !!stop.warningMessage

  const cardBg = hasConflict || showFallbackWarning
    ? 'border-orange-200 bg-orange-50'
    : stop.isAiRecommended
    ? 'border-teal-200 bg-teal-50'
    : 'border-gray-100 bg-white'

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className={`flex gap-3 p-3 rounded-lg border ${cardBg} shadow-sm`}>
        {isEditing && stop.type !== 'accommodation' && (
          <div
            {...attributes}
            {...listeners}
            className="drag-handle flex items-center text-gray-300 hover:text-gray-500 px-1"
          >
            ⠇
          </div>
        )}

        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div
            className={`w-7 h-7 rounded-full ${stop.isAiRecommended ? 'bg-teal-500' : TYPE_COLOR[stop.type]} flex items-center justify-center text-white text-xs font-bold`}
          >
            {index + 1}
          </div>
          {stop.travelTimeToNext > 0 && (
            <div className="flex flex-col items-center">
              <div className="w-0.5 bg-gray-200 h-4" />
              <span className="text-xs text-gray-400 whitespace-nowrap">{stop.travelTimeToNext}分</span>
              <div className="w-0.5 bg-gray-200 h-4" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-sm text-gray-900">{stop.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  stop.isAiRecommended
                    ? 'bg-teal-100 text-teal-700'
                    : stop.type === 'attraction' ? 'bg-blue-100 text-blue-700'
                    : stop.type === 'restaurant' ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {stop.mealType ? MEAL_TYPE_LABEL[stop.mealType] : TYPE_LABEL[stop.type]}
                </span>
                {stop.isAiRecommended && (
                  <span className="text-xs bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded font-medium">
                    AI 推薦
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {stop.arrivalTime} – {stop.departureTime}
                {stop.durationMinutes > 0 && (
                  <span className="ml-2 text-gray-400">（{stop.durationMinutes} 分鐘）</span>
                )}
              </div>
              {stop.type !== 'accommodation' && todayHours !== undefined && (
                <div className={`text-xs mt-0.5 ${hasConflict ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                  營業：{todayHours === null
                    ? '當日公休'
                    : `${todayHours.open}–${todayHours.close}`}
                </div>
              )}
            </div>
            {isEditing && stop.type !== 'accommodation' && onRemove && (
              <button
                onClick={onRemove}
                className="text-gray-300 hover:text-red-500 text-lg leading-none flex-shrink-0 mt-0.5"
              >
                ×
              </button>
            )}
          </div>
          {conflictMsg && (
            <div className="mt-1.5 text-xs text-orange-600 bg-orange-100 rounded px-2 py-1">
              ⚠ {conflictMsg}
            </div>
          )}
          {showFallbackWarning && (
            <div className="mt-1.5 text-xs text-orange-600 bg-orange-100 rounded px-2 py-1">
              ⚠ {stop.warningMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  day: DayItinerary
  dayIdx: number
  isEditing: boolean
  onReorder: (fromIdx: number, toIdx: number) => void
  onAddStop?: () => void
  onRemoveStop?: (stopId: string) => void
  openHoursMap: Record<string, OpenHours>
}

export default function DayView({ day, dayIdx, isEditing, onReorder, onAddStop, onRemoveStop, openHoursMap }: Props) {
  const [showMap, setShowMap] = useState(true)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = day.stops.findIndex((s) => s.id === active.id)
    const newIdx = day.stops.findIndex((s) => s.id === over.id)
    if (oldIdx !== -1 && newIdx !== -1) onReorder(oldIdx, newIdx)
  }

  const hours = Math.floor(day.totalTravelMinutes / 60)
  const mins = day.totalTravelMinutes % 60

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            總交通時間：
            <strong className="text-gray-800">
              {hours > 0 ? `${hours} 小時 ` : ''}{mins} 分鐘
            </strong>
          </span>
          {day.hasConstraintWarning && (
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
              ⚠ 有時間衝突
            </span>
          )}
        </div>
        <button
          onClick={() => setShowMap((v) => !v)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showMap ? '隱藏地圖' : '顯示地圖'}
        </button>
      </div>

      {showMap && (
        <div className="rounded-xl overflow-hidden border border-gray-200">
          <MapView day={day} dayIdx={dayIdx} />
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={day.stops.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {day.stops.map((stop, i) => (
              <StopCard
                key={stop.id}
                stop={stop}
                index={i}
                isEditing={isEditing}
                onRemove={onRemoveStop ? () => onRemoveStop(stop.id) : undefined}
                date={day.date}
                openHoursMap={openHoursMap}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {isEditing && onAddStop && (
        <button
          onClick={onAddStop}
          className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-500 hover:border-blue-400 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
        >
          + 新增地點
        </button>
      )}
    </div>
  )
}
