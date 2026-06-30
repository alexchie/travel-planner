import type{OpenHours}from '../../types'
import{DAY_KEYS,DAY_LABELS}from '../../types'
import TimeInput24 from './TimeInput24'

interface Props{value:OpenHours;onChange:(v:OpenHours)=>void}

const ALL_DAY_OPEN = { open: '00:00', close: '23:59' }

export default function OpenHoursEditor({value,onChange}:Props){
  function toggle(day:string,checked:boolean){onChange({...value,[day]:checked?{open:'09:00',close:'18:00'}:null})}
  function update(day:string,field:'open'|'close',val:string){
    const existing=value[day as keyof OpenHours];if(!existing)return
    onChange({...value,[day]:{...existing,[field]:val}})
  }
  function setAllOpen(){
    onChange({mon:ALL_DAY_OPEN,tue:ALL_DAY_OPEN,wed:ALL_DAY_OPEN,thu:ALL_DAY_OPEN,fri:ALL_DAY_OPEN,sat:ALL_DAY_OPEN,sun:ALL_DAY_OPEN})
  }
  const hasClosedDay = DAY_KEYS.some(d => value[d] === null)
  return(
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">勾選表示當天營業</span>
        <button type="button" onClick={setAllOpen} className="text-xs text-blue-600 hover:text-blue-800 underline">
          全天開放（無休）
        </button>
      </div>
      {hasClosedDay && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          ⚠ 有天數標記為公休，若地點實際全天開放請點「全天開放（無休）」修正
        </div>
      )}
      {DAY_KEYS.map(day=>{
        const hours=value[day]
        return(
          <div key={day} className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 w-14 cursor-pointer">
              <input type="checkbox" checked={!!hours} onChange={e=>toggle(day,e.target.checked)} className="accent-blue-600"/>
              <span className="text-gray-700">週{DAY_LABELS[day]}</span>
            </label>
            {hours?(
              <>
                <TimeInput24 value={hours.open} onChange={v=>update(day,'open',v)} className="input w-24 py-1 text-sm"/>
                <span className="text-gray-400">–</span>
                <TimeInput24 value={hours.close} onChange={v=>update(day,'close',v)} className="input w-24 py-1 text-sm"/>
              </>
            ):<span className="text-gray-400 text-xs">公休</span>}
          </div>
        )
      })}
    </div>
  )
}
