import type { Comparison } from './pose'
export type FrameResult={time:number;comparison:Comparison|null}
export type Summary={id:string;date:string;name:string;score:number;timing:number;valid:number;total:number;parts:Comparison['parts'];difficult:{time:number;score:number}[];recommendation:string}
const key='do-the-dance-history-v1'
export function summarize(frames:FrameResult[],name:string):Summary|null {
  const valid=frames.filter((x):x is {time:number;comparison:Comparison}=>!!x.comparison)
  if(!frames.length||valid.length<3) return null
  const average=(a:number[])=>Math.round(a.reduce((s,x)=>s+x,0)/a.length)
  const parts={Қол:average(valid.map(x=>x.comparison.parts.Қол)),Дене:average(valid.map(x=>x.comparison.parts.Дене)),Аяқ:average(valid.map(x=>x.comparison.parts.Аяқ))}
  const buckets=new Map<number,number[]>()
  valid.forEach(x=>{const k=Math.floor(x.time/3)*3;buckets.set(k,[...(buckets.get(k)||[]),x.comparison.poseScore])})
  const difficult=[...buckets].map(([time,scores])=>({time,score:average(scores)})).sort((a,b)=>a.score-b.score).slice(0,3)
  const weak=Object.entries(parts).sort((a,b)=>a[1]-b[1])[0][0]
  return {id:crypto.randomUUID(),date:new Date().toISOString(),name,score:average(valid.map(x=>x.comparison.poseScore)),timing:average(valid.map(x=>x.comparison.timingScore)),valid:valid.length,total:frames.length,parts,difficult,recommendation:`Келесі жаттығуда ${weak.toLowerCase()} қимылдарына көбірек көңіл бөл.`}
}
export function getHistory():Summary[]{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
export function saveSummary(s:Summary){localStorage.setItem(key,JSON.stringify([s,...getHistory()].slice(0,20)))}
export function clearHistory(){localStorage.removeItem(key)}
