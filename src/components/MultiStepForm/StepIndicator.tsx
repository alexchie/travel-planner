const STEPS = [
  { n: 1, label: '行程基本資訊' },
  { n: 2, label: '景點清單' },
  { n: 3, label: '餐廳清單' },
  { n: 4, label: '住宿設定' },
  { n: 5, label: '確認送出' },
]

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8 overflow-x-auto">
      {STEPS.map((step, idx) => (
        <div key={step.n} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step.n < current
                  ? 'bg-blue-600 text-white'
                  : step.n === current
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step.n < current ? '✓' : step.n}
            </div>
            <span
              className={`text-xs whitespace-nowrap ${
                step.n === current ? 'text-blue-600 font-medium' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`w-10 h-0.5 mb-4 ${step.n < current ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
