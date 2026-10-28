import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type Pose = NormalizedLandmark[]
export type Sample = { time: number; pose: Pose | null; poseCount?: number; trackState?: 'tracked'|'lost'|'ambiguous'; trackReason?: string; segment?: number; personIndex?: number }
export type Part = 'Қол' | 'Дене' | 'Аяқ'
export type Comparison = { poseScore: number; timingScore: number; parts: Record<Part, number>; cue: string; highlight: number[]; matchedTime: number }

const I = { LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16, LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28 } as const
const required = Object.values(I)
const connections = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]]
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

export function poseIssue(pose: Pose | null, poseCount = pose ? 1 : 0): string | null {
  if (poseCount > 1) return 'Кадрда бірнеше адам бар. Бір адам ғана көрінетін үзіндіні таңдаңыз.'
  if (!pose) return 'Адам анықталмады. Камераға толық денеңізбен көрініңіз.'
  const confident=(i:number)=>!!pose[i]&&(pose[i].visibility??0)>=.55
  if ([I.LS,I.RS,I.LH,I.RH].some(i=>!confident(i)) ||
      [I.LE,I.RE,I.LW,I.RW,I.LK,I.RK,I.LA,I.RA].filter(confident).length<6 ||
      ![I.LW,I.RW].some(confident) || ![I.LA,I.RA].some(confident))
    return 'Дене нүктелері сенімді анықталмады. Жарықты арттырып, кадрға толық кіріңіз.'
  if ([I.LW,I.RW,I.LA,I.RA].some(i => confident(i)&&(pose[i].x < .025 || pose[i].x > .975 || pose[i].y < .025 || pose[i].y > .975))) return 'Қол не аяқ кадрдан шығып тұр. Камерадан сәл алыстаңыз.'
  return null
}

function point(p: Pose, i: number, aspect: number) { return { x: p[i].x * aspect, y: p[i].y } }
function angle(p: Pose, a: number, b: number, c: number, aspect: number) {
  const A=point(p,a,aspect), B=point(p,b,aspect), C=point(p,c,aspect)
  const u={x:A.x-B.x,y:A.y-B.y}, v={x:C.x-B.x,y:C.y-B.y}
  return Math.acos(clamp((u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y)||1),-1,1))*180/Math.PI
}
function measures(p: Pose, aspect: number) {
  return [
    angle(p,I.LS,I.LE,I.LW,aspect),angle(p,I.RS,I.RE,I.RW,aspect),
    angle(p,I.LE,I.LS,I.LH,aspect),angle(p,I.RE,I.RS,I.RH,aspect),
    angle(p,I.LS,I.LH,I.LK,aspect),angle(p,I.RS,I.RH,I.RK,aspect),
    angle(p,I.LH,I.LK,I.LA,aspect),angle(p,I.RH,I.RK,I.RA,aspect)
  ]
}
function normalized(p: Pose, aspect: number, i: number) {
  const h={x:(p[I.LH].x+p[I.RH].x)/2*aspect,y:(p[I.LH].y+p[I.RH].y)/2}
  const s={x:(p[I.LS].x+p[I.RS].x)/2*aspect,y:(p[I.LS].y+p[I.RS].y)/2}
  const size=Math.max(.1,Math.hypot(s.x-h.x,s.y-h.y))
  return {x:(p[i].x*aspect-h.x)/size,y:(p[i].y-h.y)/size}
}
const descriptions = ['Сол қолыңды','Оң қолыңды','Сол иығыңды','Оң иығыңды','Сол аяғыңды','Оң аяғыңды','Сол тізеңді','Оң тізеңді']
const indices = [I.LW,I.RW,I.LE,I.RE,I.LK,I.RK,I.LA,I.RA]
const groups: Part[] = ['Қол','Қол','Дене','Дене','Аяқ','Аяқ','Аяқ','Аяқ']

function scorePair(reference: Pose, current: Pose, refAspect: number, camAspect: number) {
  const a=measures(reference,refAspect), b=measures(current,camAspect)
  const joints=[[I.LS,I.LE,I.LW],[I.RS,I.RE,I.RW],[I.LE,I.LS,I.LH],[I.RE,I.RS,I.RH],[I.LS,I.LH,I.LK],[I.RS,I.RH,I.RK],[I.LH,I.LK,I.LA],[I.RH,I.RK,I.RA]]
  const reliable=(i:number)=>(reference[i].visibility??0)>=.55&&(current[i].visibility??0)>=.55
  const scores=a.map((v,i)=>joints[i].every(reliable)?clamp(1-Math.abs(v-b[i])/90):null)
  const positional=[I.LW,I.RW,I.LK,I.RK,I.LA,I.RA].filter(reliable).map(i=>{
    const x=normalized(reference,refAspect,i), y=normalized(current,camAspect,i)
    return clamp(1-Math.hypot(x.x-y.x,x.y-y.y)/1.5)
  })
  const mean=(v:number[])=>v.reduce((s,x)=>s+x,0)/v.length
  const valid=scores.filter((v):v is number=>v!==null)
  return {score:valid.length>=4&&positional.length>=3?mean(valid)*.75+mean(positional)*.25:-1, scores}
}

// Reflect spatial coordinates and exchange anatomical sides so displayed poses match.
export function reflectPose(pose: Pose): Pose {
  const reflected=pose.map(p=>({...p,x:1-p.x}))
  for(const [left,right] of [[1,4],[2,5],[3,6],[7,8],[9,10],[11,12],[13,14],[15,16],[17,18],[19,20],[21,22],[23,24],[25,26],[27,28],[29,30],[31,32]]){
    [reflected[left],reflected[right]]=[reflected[right],reflected[left]]
  }
  return reflected
}

export function compare(reference: Sample[], current: Pose, time: number, offset: number, refAspect: number, camAspect: number, mirrored = false, referenceMirrored = mirrored): Comparison | null {
  if (poseIssue(current)) return null
  const target=time+offset
  const currentSample=nearestSample(reference,target)
  if(!currentSample||poseIssue(currentSample.pose,currentSample.poseCount)||currentSample.trackState==='lost'||currentSample.trackState==='ambiguous'||target<reference[0].time-.05||target>reference[reference.length-1].time+.05)return null
  const candidates=reference.filter(s=>s.segment===currentSample.segment && s.pose && !poseIssue(s.pose,s.poseCount) && Math.abs(s.time-target)<=.75)
  if (!candidates.length) return null
  const evaluated=candidates.map(s=>{
    const pose=mirrored!==referenceMirrored?reflectPose(s.pose!):s.pose!
    return {s,pose,...scorePair(pose,current,refAspect,camAspect)}
  }).filter(candidate=>candidate.score>=0)
  if(!evaluated.length)return null
  const best=evaluated.sort((x,y)=>y.score-x.score)[0]
  const parts: Record<Part, number>={Қол:0,Дене:0,Аяқ:0}
  ;(['Қол','Дене','Аяқ'] as Part[]).forEach(part=>{const v=best.scores.filter((score,i):score is number=>groups[i]===part&&score!==null);parts[part]=v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length*100):0})
  const worst=best.scores.indexOf(Math.min(...best.scores.map(v=>v??Infinity)))
  const ref=normalized(best.pose,refAspect,indices[worst]), cur=normalized(current,camAspect,indices[worst])
  const dx=(ref.x-cur.x)*(mirrored?-1:1)
  const instruction=ref.y<cur.y-.12?'жоғарырақ көтер':ref.y>cur.y+.12?'төменірек түсір':dx<-.12?'солға қарай жылжыт':dx>.12?'оңға қарай жылжыт':'қалпын түзет'
  return {
    poseScore:Math.round(best.score*100),
    timingScore:Math.round(clamp(1-Math.abs(best.s.time-target)/.75)*100),
    parts,
    cue:best.scores[worst]!>.86?'Қимыл жақсы! Ырғақты сақта.':`${descriptions[worst]} ${instruction}.`,
    highlight:best.scores[worst]!>.86?[]:[indices[worst]],
    matchedTime:best.s.time
  }
}

export function drawPose(canvas: HTMLCanvasElement | null, pose: Pose | null, mirrored: boolean, highlight: number[] = [], videoWidth?: number, videoHeight?: number, style: {color?:string; dashed?:boolean; overlay?:boolean} = {}) {
  if (!canvas) return
  const {width,height}=canvas
  const ctx=canvas.getContext('2d')
  if (!ctx) return
  if(!style.overlay) ctx.clearRect(0,0,width,height)
  if (!pose) return
  const scale=videoWidth&&videoHeight?Math.min(width/videoWidth,height/videoHeight):1
  const drawnWidth=videoWidth&&videoHeight?videoWidth*scale:width
  const drawnHeight=videoWidth&&videoHeight?videoHeight*scale:height
  const left=(width-drawnWidth)/2, top=(height-drawnHeight)/2
  const x=(i:number)=>left+(mirrored?1-pose[i].x:pose[i].x)*drawnWidth
  const y=(i:number)=>top+pose[i].y*drawnHeight
  ctx.save()
  ctx.setLineDash(style.dashed?[Math.max(5,width/60),Math.max(4,width/90)]:[])
  ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(2,width/180)*(style.dashed?2.2:1)
  for (const [a,b] of connections) {
    if ((pose[a].visibility??0)<.45||(pose[b].visibility??0)<.45) continue
    ctx.strokeStyle=highlight.includes(a)||highlight.includes(b)?'#f47764':(style.color||'#a6f0d3')
    ctx.beginPath();ctx.moveTo(x(a),y(a));ctx.lineTo(x(b),y(b));ctx.stroke()
  }
  ctx.setLineDash([])
  for (const i of required) {
    if ((pose[i].visibility??0)<.45) continue
    ctx.fillStyle=highlight.includes(i)?'#f47764':(style.color||'#a6f0d3')
    ctx.strokeStyle='#172320';ctx.lineWidth=2
    ctx.beginPath();ctx.arc(x(i),y(i),Math.max(3,width/100)*(style.dashed?1.6:1),0,Math.PI*2);if(!style.dashed)ctx.fill();ctx.strokeStyle=style.dashed?(style.color||'#c4a2ff'):'#172320';ctx.stroke()
  }
  ctx.restore()
}

export function nearestSample(samples: Sample[], time: number): Sample | null {
  if (!samples.length) return null
  return samples.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b)
}
