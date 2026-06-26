import { useAppState } from './store'
import MultiStepForm from './components/MultiStepForm'
import ItineraryView from './components/ItineraryView'

export default function App() {
  const { page } = useAppState()
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            T
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">自動行程規劃系統</h1>
            <p className="text-xs text-gray-500">最短交通時間 · 智能排程</p>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {page === 'form' ? <MultiStepForm /> : <ItineraryView />}
      </main>
    </div>
  )
}
