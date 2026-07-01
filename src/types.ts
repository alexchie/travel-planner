export type TransportMode = 'motorcycle' | 'car' | 'walking' | 'transit'
export type Priority = 'must' | 'flexible'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'afternoon_tea' | 'supper' | 'any'
export type MealAssignmentMode = 'fixed_day' | 'fixed_meal_only' | 'flexible'
export type DishType = 'full_meal' | 'snack'
export type VersionType = 'original' | 'edited_copy'
export type StopType = 'attraction' | 'restaurant' | 'accommodation'

export interface GeoPoint {
  lat: number
  lng: number
  address: string
}

export interface DayHours {
  open: string
  close: string
}

export type OpenHours = {
  [key in 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun']: DayHours | null
}

export interface TimeWindow {
  date: string
  startTime: string
  endTime: string
}

export interface TripInfo {
  arrivalDatetime: string
  departureDatetime: string
  startLocation: GeoPoint
  endLocation: GeoPoint
  transportMode: TransportMode
}

export interface Attraction {
  id: string
  name: string
  location: GeoPoint
  openHours: OpenHours
  durationMinutes: number
  priority: Priority
  timeWindowRequired: TimeWindow | null
  notes?: string
}

export interface Restaurant {
  id: string
  name: string
  location: GeoPoint
  openHours: OpenHours
  mealType: MealType
  mealAssignmentMode: MealAssignmentMode
  assignedDay: number | null
  dishType: DishType
  priority: Priority
}

export interface Accommodation {
  dayIndex: number
  name: string
  location: GeoPoint
}

export interface Stop {
  id: string
  itemId?: string
  type: StopType
  name: string
  location: GeoPoint
  arrivalTime: string
  departureTime: string
  durationMinutes: number
  travelTimeToNext: number
  hasWarning: boolean
  warningMessage?: string
  mealType?: MealType
  isAiRecommended?: boolean
}

export interface DayItinerary {
  dayIndex: number
  date: string
  stops: Stop[]
  totalTravelMinutes: number
  hasConstraintWarning: boolean
}

export interface Conflict {
  type: 'time_overlap' | 'distance_infeasible'
  itemA: string
  itemB: string
  message: string
}

export const SNACK_REQUIRED: Record<MealType, number> = {
  breakfast: 2,
  lunch: 3,
  dinner: 3,
  afternoon_tea: 1,
  supper: 2,
  any: 0,
}

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  afternoon_tea: '下午茶',
  supper: '宵夜',
  any: '都可以',
}

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  car: '汽車',
  motorcycle: '機車',
  walking: '走路',
  transit: '大眾交通',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  must: '必去',
  flexible: '彈性',
}

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const DAY_LABELS: Record<string, string> = {
  mon: '一', tue: '二', wed: '三', thu: '四', fri: '五', sat: '六', sun: '日',
}

export function defaultOpenHours(): OpenHours {
  return {
    mon: { open: '09:00', close: '18:00' },
    tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' },
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '18:00' },
    sat: { open: '09:00', close: '18:00' },
    sun: null,
  }
}
