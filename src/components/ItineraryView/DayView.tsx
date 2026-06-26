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
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DayItinerary, Stop } from '../../types'
import { MEAL_TYPE_LABEL } from '../../types'
import MapView from '../MapView'

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

function StopCard({
  stop,
  index,
  isEditing,
}: {
  stop: Stop
  index: number
  isEditing: boolean
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

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        className={`flex gap-3 p-3 rounded-lg border ${
          stop.hasWarning ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'
        } shadow-sm`}
      >
        {isEditing && stop.type !== 'accommodation' && (
          <div
            {...attributes}
            {...listeners}
            className="drag-handle flex items-center text-gray-300 hover:text-gray-500 px-1"
          >
            ⠿
          </div>
        )}

        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div
            className={`w-7 h-7 rounded-full ${TYPE_COLOR[stop.type]} flex items-center justify-center text-white text-xs font-bold`}
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
                  stop.type === 'attraction' ? 'bg-blue-100 text-blue-700' :
                  stop.type === 'restaurant' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {stop.mealType ? MEAL_TYPE_LABEL[stop.mealType] : TYPE_LABEL[stop.type]}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {stop.arrivalTime} – {stop.departureTime}
                {stop.durationMinutes > 0 && (
                  <span className="ml-2 text-gray-400">（{stop.durationMinutes} 分鐘）</span>
                )}
              </div>
            </div>
          </div>
          {stop.hasWarning && stop.warningMessage && (
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
}

export default function DayView({ day, dayIdx, isEditing, onReorder }: Props) {
  const [showMap, setShowMap] = useState(false)
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
              <StopCard key={stop.id} stop={stop} index={i} isEditing={isEditing} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
