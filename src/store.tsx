import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type {
  TripInfo,
  Attraction,
  Restaurant,
  Accommodation,
  DayItinerary,
  Conflict,
} from './types'

interface AppState {
  page: 'form' | 'result'
  currentStep: number
  trip: TripInfo | null
  attractions: Attraction[]
  restaurants: Restaurant[]
  accommodations: Accommodation[]
  originalItinerary: DayItinerary[] | null
  editedItinerary: DayItinerary[] | null
  isEditing: boolean
  conflicts: Conflict[]
  loading: boolean
  aiError: string | null
}

type Action =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_TRIP'; trip: TripInfo }
  | { type: 'SET_ATTRACTIONS'; attractions: Attraction[] }
  | { type: 'SET_RESTAURANTS'; restaurants: Restaurant[] }
  | { type: 'SET_ACCOMMODATIONS'; accommodations: Accommodation[] }
  | { type: 'SET_RESULT'; original: DayItinerary[]; conflicts: Conflict[] }
  | { type: 'ENTER_EDIT' }
  | { type: 'EXIT_EDIT' }
  | { type: 'SAVE_EDIT' }
  | { type: 'RESET_EDIT' }
  | { type: 'UPDATE_EDITED'; itinerary: DayItinerary[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'GO_TO_FORM' }
  | { type: 'GO_TO_RESULT' }
  | { type: 'ADD_STOP'; dayIndex: number; stop: import('./types').Stop }
  | { type: 'REMOVE_STOP'; dayIndex: number; stopId: string }

const initial: AppState = {
  page: 'form',
  currentStep: 1,
  trip: null,
  attractions: [],
  restaurants: [],
  accommodations: [],
  originalItinerary: null,
  editedItinerary: null,
  isEditing: false,
  conflicts: [],
  loading: false,
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step }
    case 'SET_TRIP':
      return { ...state, trip: action.trip }
    case 'SET_ATTRACTIONS':
      return { ...state, attractions: action.attractions }
    case 'SET_RESTAURANTS':
      return { ...state, restaurants: action.restaurants }
    case 'SET_ACCOMMODATIONS':
      return { ...state, accommodations: action.accommodations }
    case 'SET_RESULT':
      return {
        ...state,
        originalItinerary: action.original,
        editedItinerary: null,
        conflicts: action.conflicts,
        page: action.conflicts.length === 0 ? 'result' : 'form',
        loading: false,
      }
    case 'ENTER_EDIT':
      return {
        ...state,
        isEditing: true,
        editedItinerary: JSON.parse(JSON.stringify(state.originalItinerary)),
      }
    case 'EXIT_EDIT':
      return { ...state, isEditing: false, editedItinerary: null }
    case 'SAVE_EDIT':
      return {
        ...state,
        isEditing: false,
        originalItinerary: state.editedItinerary ?? state.originalItinerary,
        editedItinerary: null,
      }
    case 'RESET_EDIT':
      return {
        ...state,
        editedItinerary: JSON.parse(JSON.stringify(state.originalItinerary)),
      }
    case 'UPDATE_EDITED':
      return { ...state, editedItinerary: action.itinerary }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    case 'GO_TO_FORM':
      return { ...state, page: 'form', currentStep: 1 }
    case 'GO_TO_RESULT':
      return { ...state, page: 'result' }
    case 'ADD_STOP': {
      if (!state.editedItinerary) return state
      return {
        ...state,
        editedItinerary: state.editedItinerary.map((day) => {
          if (day.dayIndex !== action.dayIndex) return day
          const stops = [...day.stops]
          const lastIdx = stops.length - 1
          if (stops[lastIdx]?.type === 'accommodation') {
            stops.splice(lastIdx, 0, action.stop)
          } else {
            stops.push(action.stop)
          }
          return { ...day, stops }
        }),
      }
    }
    case 'REMOVE_STOP': {
      if (!state.editedItinerary) return state
      return {
        ...state,
        editedItinerary: state.editedItinerary.map((day) => {
          if (day.dayIndex !== action.dayIndex) return day
          return { ...day, stops: day.stops.filter((s) => s.id !== action.stopId) }
        }),
      }
    }
    default:
      return state
  }
}

const StateCtx = createContext<AppState>(initial)
const DispatchCtx = createContext<React.Dispatch<Action>>(() => {})

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export const useAppState = () => useContext(StateCtx)
export const useDispatch = () => useContext(DispatchCtx)
