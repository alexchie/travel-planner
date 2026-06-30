import { useAppState, useDispatch } from './store'
import MultiStepForm from './components/MultiStepForm'
import ItineraryView from './components/ItineraryView'
import HomePage from './components/HomePage'

export default function App() {
  const { page } = useAppState()
  const dispatch = useDispatch()
  return (
    <div className="min-h-screen bg-app">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <button
            onClick={() => dispatch({ type: 'GO_TO_HOME' })}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
              T
            </div>
            <span className="font-bold text-slate-800 text-sm tracking-tight">行程規劃系統</span>
          </button>
          {page !== 'home' && (
            <button
              onClick={() => dispatch({ type: 'GO_TO_HOME' })}
              className="btn-ghost"
            >
              首頁
            </button>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-7">
        {page === 'home' && <HomePage />}
        {page === 'form' && <MultiStepForm />}
        {page === 'result' && <ItineraryView />}
      </main>
    </div>
  )
}
