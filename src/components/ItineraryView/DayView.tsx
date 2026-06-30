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

const TYPE_BORDER: Record<string, string> = {
  attraction: 'border-l-blue-400',
  restaurant: 'border-l-amber-400',
  accommodation: 'border-l-emerald-400',
}

const TYPE_DOT: Record<string, string> = {
  attraction: 'bg-blue-500',
  restaurant: 'bg-amber-500',
  accommodation: 'bg-emerald-500',
}

const TYPE_BADGE: Record<string, string> = {
  attraction: 'badge-blue',
  restaurant: 'badge-amber',
  accommodation: 'badge-green',
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

function effectiveCloseMin(openStr: string, closeStr: string): number {
  const o = toMin(openStr)
  let c = toMin(closeStr)
  if (c === 0) c = 1440       // "00:00" 代表午夜 = 一天結束
  if (c <= o) c += 1440       // 跨夜（例如 11:30–01:30）
  return c
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
  const close = effectiveCloseMin(dh.open, dh.close)
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
  const hasAlert = hasConflict || showFallbackWarning

  const isStart = stop.type === 'accommodation' && stop.name.startsWith('起點')
  const isEnd = stop.type === 'accommodation' && stop.name.startsWith('終點')
  const isWaypoint = isStart || isEnd

  const borderClass = hasAlert
    ? 'border-l-orange-400'
    : stop.isAiRecommended
    ? 'border-l-teal-400'
    : isWaypoint ? 'border-l-slate-400'
    : TYPE_BORDER[stop.type]

  const dotClass = stop.isAiRecommended ? 'bg-teal-500'
    : isWaypoint ? 'bg-slate-400'
    : TYPE_DOT[stop.type]

  const badgeClass = stop.isAiRecommended ? 'badge-teal'
    : isWaypoint ? 'badge-gray'
    : TYPE_BADGE[stop.type]

  const stopLabel = stop.mealType
    ? MEAL_TYPE_LABEL[stop.mealType]
    : isStart ? '起點'
    : isEnd ? '終點'
    : TYPE_LABEL[stop.type]

  return (
    <div ref={setNodeRef} style={style}>
      {/* Stop card */}
      <div className={`bg-white rounded-xl border border-slate-100 border-l-4 ${borderClass} shadow-sm overflow-hidden`}>
        <div className="flex gap-2 p-3.5">
          {/* Drag handle */}
          {isEditing && stop.type !== 'accommodation' && (
            <div
              {...attributes}
              {...listeners}
              className="drag-handle flex items-center self-stretch px-0.5 text-slate-300 hover:text-slate-500"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="7" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="17" r="1.5" /><circle cx="15" cy="17" r="1.5" />
              </svg>
            </div>
          )}

          {/* Index dot */}
          <div className="flex-shrink-0 pt-0.5">
            <div className={`w-6 h-6 rounded-full ${dotClass} flex items-center justify-center text-white text-[10px] font-bold`}>
              {index + 1}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm text-slate-900 leading-tight">{stop.name}</span>
                  <span className={badgeClass}>
                    {stop.mealType ? MEAL_TYPE_LABEL[stop.mealType] : TYPE_LABEL[stop.type]}
                  </span>
                  {stop.isAiRecommended && (
                    <span className="badge-teal">AI 推薦</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{stop.arrivalTime}</span>
                  <span>→</span>
                  <span className="font-medium text-slate-700">{stop.departureTime}</span>
                  {stop.durationMinutes > 0 && (
                    <span className="text-slate-400">· {stop.durationMinutes} 分鐘</span>
                  )}
                </div>

                {stop.type !== 'accommodation' && hasOpenHoursData && (
                  <div className={`mt-1 text-xs ${hasConflict ? 'text-orange-500 font-medium' : 'text-slate-400'}`}>
                    {hasConflict ? '⚠ ' : ''}營業：{todayHours === null
                      ? '當日公休'
                      : `${todayHours.open}–${todayHours.close}`}
                  </div>
                )}
              </div>

              {isEditing && stop.type !== 'accommodation' && onRemove && (
                <button
                  onClick={onRemove}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-md transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {conflictMsg && (
              <div className="mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
                {conflictMsg}
              </div>
            )}
            {showFallbackWarning && (
              <div className="mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
                {stop.warningMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Travel connector */}
      {stop.travelTimeToNext > 0 && (
        <div className="flex items-center gap-2 py-1.5 px-4">
          <div className="h-px flex-1 bg-slate-200" />
          <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            {stop.travelTimeToNext} 分鐘
          </div>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      )}
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">
            交通時間：<strong className="text-slate-700">{hours > 0 ? `${hours}h ` : ''}{mins}min</strong>
          </span>
          {day.hasConstraintWarning && (
            <span className="badge bg-orange-50 text-orange-500 border border-orange-200">⚠ 時間衝突</span>
          )}
        </div>
        <button
          onClick={() => setShowMap((v) => !v)}
          className="btn-ghost text-xs py-1"
        >
          {showMap ? '收起地圖' : '顯示地圖'}
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
          className="w-full py-2.5 border-2 border-dashed border-blue-200 text-blue-500
                     hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600
                     rounded-xl text-sm font-medium transition-all duration-150"
        >
          + 新增地點
        </button>
      )}
    </div>
  )
}
