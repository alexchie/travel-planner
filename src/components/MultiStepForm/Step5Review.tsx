import { useDispatch, useAppState } from '../../store'
import { TRANSPORT_LABEL, MEAL_TYPE_LABEL } from '../../types'
import { detectConflicts } from '../../optimizer/conflictDetection'
import { optimize } from '../../optimizer'

export default function Step5Review() {
  const state = useAppState()
  const dispatch = useDispatch()
  const { trip, attractions, restaurants, accommodations, loading } = state

  function back() {
    dispatch({ type: 'SET_STEP', step: 4 })
  }

  function run() {
    if (!trip) return
    dispatch({ type: 'SET_LOADING', loading: true })

    setTimeout(() => {
      const conflicts = detectConflicts(attractions, restaurants, trip.transportMode)
      if (conflicts.length > 0) {
        dispatch({ type: 'SET_RESULT', original: [], conflicts })
        return
      }
      const itinerary = optimize(trip, attractions, restaurants, accommodations)
      dispatch({ type: 'SET_RESULT', original: itinerary, conflicts: [] })
    }, 600)
  }

  if (!trip) return null

  const totalDays = Math.ceil(
    (new Date(trip.departureDatetime).getTime() - new Date(trip.arrivalDatetime).getTime()) /
      (1000 * 60 * 60 * 24)
  ) + 1

  return (
    <div className="card step-enter max-w-2xl mx-auto space-y-6">
      <h2 className="section-title">確認行程資訊</h2>

      <div className="space-y-4">
        <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
          <h3 className="font-semibold text-blue-900">基本資訊</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
            <span className="text-gray-500">抵達</span>
            <span>{trip.arrivalDatetime.replace('T', ' ')}</span>
            <span className="text-gray-500">離開</span>
            <span>{trip.departureDatetime.replace('T', ' ')}</span>
            <span className="text-gray-500">天數</span>
            <span>{totalDays} 天</span>
            <span className="text-gray-500">交通方式</span>
            <span>{TRANSPORT_LABEL[trip.transportMode]}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{attractions.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">景點</div>
            <div className="text-xs text-red-500">
              {attractions.filter((a) => a.priority === 'must').length} 個必去
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{restaurants.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">餐廳/小吃</div>
            <div className="text-xs text-gray-400 text-xs">
              {[...new Set(restaurants.map((r) => r.mealType))]
                .map((m) => MEAL_TYPE_LABEL[m])
                .join('、') || '無'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{accommodations.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">住宿</div>
          </div>
        </div>

        {attractions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">景點清單</h3>
            <div className="space-y-1">
              {attractions.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className={`w-2 h-2 rounded-full ${a.priority === 'must' ? 'bg-red-400' : 'bg-gray-300'}`} />
                  {a.name || '（未命名）'}
                  <span className="text-gray-400">{a.durationMinutes} 分鐘</span>
                  {a.timeWindowRequired && (
                    <span className="text-blue-500 text-xs">
                      {a.timeWindowRequired.date} {a.timeWindowRequired.startTime}–{a.timeWindowRequired.endTime}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {restaurants.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">餐廳/小吃</h3>
            <div className="space-y-1">
              {restaurants.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {r.name || '（未命名）'}
                  <span className="text-gray-400">{MEAL_TYPE_LABEL[r.mealType]}</span>
                  {r.dishType === 'snack' && (
                    <span className="text-purple-500 text-xs">小吃</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {state.conflicts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-red-700">偵測到衝突，請修正後重新送出</h3>
            {state.conflicts.map((c, i) => (
              <p key={i} className="text-sm text-red-600">{c.message}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <button onClick={back} className="btn-secondary">上一步</button>
        <button onClick={run} disabled={loading} className="btn-primary gap-2 flex items-center">
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              計算最佳行程中…
            </>
          ) : (
            '開始規劃行程'
          )}
        </button>
      </div>
    </div>
  )
}
