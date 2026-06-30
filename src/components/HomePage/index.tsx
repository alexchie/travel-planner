import { useEffect, useState } from 'react'
import { useDispatch } from '../../store'
import { listSessions, loadSession, deleteSession } from '../../lib/history'
import type { StoredSession } from '../../lib/history'

type SessionSummary = ReturnType<typeof listSessions>[number]

export default function HomePage() {
  const dispatch = useDispatch()
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  useEffect(() => {
    setSessions(listSessions())
  }, [])

  function handleLoad(id: string) {
    const session = loadSession(id)
    if (session) dispatch({ type: 'LOAD_SESSION', session: session as StoredSession })
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('確定刪除這筆記錄？')) return
    deleteSession(id)
    setSessions(listSessions())
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })
  }

  function formatTrip(s: SessionSummary) {
    const info = s.tripInfo
    const startDate = info.arrivalDatetime?.slice(0, 10)
    return { start: startDate ? formatDate(startDate) : '', dest: info.startLocation?.address?.split(',')[0] ?? '' }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card text-center py-10 space-y-4">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto">T</div>
        <h2 className="text-2xl font-bold text-gray-900">自動行程規劃系統</h2>
        <p className="text-gray-500 text-sm">輸入景點、餐廳、住宿，系統自動規劃最佳行程</p>
        <button
          onClick={() => dispatch({ type: 'NEW_TRIP' })}
          className="btn-primary text-base px-8 py-3"
        >
          開始新行程
        </button>
      </div>

      {sessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 px-1">過去的旅行規劃</h3>
          {sessions.map((s) => {
            const { start, dest } = formatTrip(s)
            return (
              <div
                key={s.id}
                onClick={() => handleLoad(s.id)}
                className="card cursor-pointer hover:shadow-md hover:border-blue-200 transition-all border border-gray-200 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {s.totalDays}天
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{dest || '（未命名行程）'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {start && <span>{start} · </span>}
                      {s.totalStops} 個景點/餐廳 · 規劃於 {formatDate(s.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-medium">查看</span>
                  <button
                    onClick={(e) => handleDelete(s.id, e)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none p-1"
                    title="刪除"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
