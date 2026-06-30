const STEPS = [
  { n: 1, label: '基本資訊' },
  { n: 2, label: '景點' },
  { n: 3, label: '餐廳' },
  { n: 4, label: '住宿' },
  { n: 5, label: '確認送出' },
]

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const done = step.n < current
          const active = step.n === current
          return (
            <div key={step.n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done
                    ? 'bg-blue-600 text-white shadow-sm'
                    : active
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm'
                    : 'bg-white border-2 border-slate-200 text-slate-400'
                }`}>
                  {done ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : step.n}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap transition-colors ${
                  active ? 'text-blue-600' : done ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-300 ${
                  step.n < current ? 'bg-blue-500' : 'bg-slate-200'
                }`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
