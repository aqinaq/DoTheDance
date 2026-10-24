const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value))
export type Clip={start:number;end:number}
export function moveStart(current:Clip,duration:number,value:number):Clip {
  const length=clamp(current.end-current.start,.5,60)
  const start=clamp(Number.isFinite(value)?value:current.start,0,Math.max(0,duration-.5))
  const end=start>=current.end-.5?Math.min(duration,start+length):Math.min(current.end,start+60)
  return {start,end:Math.max(start+.5,end)}
}
export function moveEnd(current:Clip,duration:number,value:number):Clip {
  const length=clamp(current.end-current.start,.5,60)
  const end=clamp(Number.isFinite(value)?value:current.end,.5,duration)
  const start=end<=current.start+.5?Math.max(0,end-length):Math.max(current.start,end-60)
  return {start:Math.min(start,end-.5),end}
}
