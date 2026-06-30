import { useEffect, useState } from 'react'
import { useDispatch } from '../../store'
import { listSessions, loadSession, deleteSession } from '../../lib/history'
import type { StoredSession } from '../../lib/history'

type SessionSummary = ReturnType<typeof listSessions>[number]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function DayIcon({ days }: { days: number }) {
  return (
    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex flex-col items-center justify-center text-white shadow-sm flex-shrink-0">
      <span className="text-lg font-bold leading-none">{days}</span>
      <span className="text-[10px] opacity-80 leading-none mt-0.5">天</span>
    </div>
  )
}

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

  const dest = (s: SessionSummary) =>
    s.tripInfo.startLocation?.address?.split(',')[0]?.trim() ?? '行程'
  const startDate = (s: SessionSummary) =>
    s.tripInfo.arrivalDatetime ? formatDate(s.tripInfo.arrivalDatetime.slice(0, 10)) : ''

  return (
    <div className="max-w-2xl mx-auto space-y-8 fade-in">

      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 shadow-lg">
        <div className="space-y-2 mb-7">
          <p className="text-blue-200 text-sm font-medium tracking-wide">智能行程規劃</p>
          <h1 className="text-3xl font-bold tracking-tight">讓旅行<br />更有效率</h1>
          <p className="text-blue-100/80 text-sm">輸入景點與餐廳，系統自動排出交通最優化的行程</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'NEW_TRIP' })}
          className="inline-flex items-center gap-2 bg-white text-blue-700 text-sm font-bold
                     px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md hover:bg-blue-50
                     transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          開始新行程
        </button>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '🗺', title: '智能排序', desc: '最短交通時間' },
          { icon: '🕐', title: '時段偵測', desc: '自動比對營業時間' },
          { icon: '✏️', title: '自由編輯', desc: '拖曳調整行程' },
        ].map((f) => (
          <div key={f.title} className="card text-center py-4 px-3 space-y-1">
            <div className="text-2xl">{f.icon}</div>
            <p className="text-sm font-semibold text-slate-800">{f.title}</p>
            <p className="text-xs text-slate-400">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Past sessions */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-700">過去的行程</h2>
            <span className="badge-gray">{sessions.length} 筆</span>
          </div>

          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleLoad(s.id)}
                className="card-hover flex items-center gap-4"
              >
                <DayIcon days={s.totalDays} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{dest(s)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {startDate(s) && <span>{startDate(s)} · </span>}
                    {s.totalStops} 個地點 · 規劃於 {formatDate(s.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="badge-blue">查看</span>
                  <button
                    onClick={(e) => handleDelete(s.id, e)}
                    className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                    title="刪除"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
