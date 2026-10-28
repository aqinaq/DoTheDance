import { poseIssue, type Pose, type Sample } from './pose'

export type Detection = { pose: Pose; appearance: number[] }
export type DetectionFrame = { time: number; people: Detection[] }
export type Anchor = { frame: number; person: number }
export type TrackState = 'tracked' | 'lost' | 'ambiguous'
const torso = [11,12,23,24]
export function center(p:Pose) { return {x:torso.reduce((s,i)=>s+p[i].x,0)/4,y:torso.reduce((s,i)=>s+p[i].y,0)/4} }
function scale(p:Pose) { return Math.max(.035,Math.hypot((p[11].x+p[12].x-p[23].x-p[24].x)/2,(p[11].y+p[12].y-p[23].y-p[24].y)/2)) }
function visible(p:Pose) { return torso.every(i=>p[i]&&(p[i].visibility??0)>.55) }
function appearanceDistance(a:number[],b:number[]) { return a.length&&a.length===b.length?a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/6:1 }
export function bounds(p:Pose) {
  const visiblePoints=p.filter((v,i)=>i>=11&&(v.visibility??0)>.5)
  const points=visiblePoints.length?visiblePoints:torso.map(i=>p[i])
  return {left:Math.max(0,Math.min(...points.map(v=>v.x))-.025),top:Math.max(0,Math.min(...points.map(v=>v.y),...(p.filter(v=>(v.visibility??0)>.5).map(v=>v.y)))-.025),right:Math.min(1,Math.max(...points.map(v=>v.x))+.025),bottom:Math.min(1,Math.max(...points.map(v=>v.y))+.025)}
}
/** Follow consecutive frames only. Missing/ambiguous identities require a new user anchor. */
export function trackDancer(frames:DetectionFrame[],anchors:Anchor[]):Sample[] {
  const votes:Map<number,Set<number>>=new Map()
  const uncertain=new Set<number>()
  const reasons=new Map<number,string>()
  const validAnchors=anchors.filter(a=>frames[a.frame]?.people[a.person])
  for(const anchor of validAnchors){
    const seed=frames[anchor.frame].people[anchor.person]
    const add=(f:number,p:number)=>{if(!votes.has(f))votes.set(f,new Set());votes.get(f)!.add(p)}
    add(anchor.frame,anchor.person)
    for(const direction of [-1,1]){
      let previous=seed, velocity={x:0,y:0}
      for(let f=anchor.frame+direction;f>=0&&f<frames.length;f+=direction){
        const c=center(previous.pose), unit=scale(previous.pose)
        const crowded=frames[f-direction].people.some(other=>other!==previous&&Math.hypot(center(other.pose).x-c.x,center(other.pose).y-c.y)<unit*.4)
        if(crowded){uncertain.add(f);reasons.set(f,'Бишілер тым жақын орналасқан');break}
        const predicted={x:c.x+velocity.x,y:c.y+velocity.y}
        const ranked=frames[f].people.map((candidate,index)=>{
          if(!visible(candidate.pose))return {index,cost:Infinity}
          const n=center(candidate.pose)
          const motion=Math.hypot(n.x-predicted.x,n.y-predicted.y)/unit
          const color=.65*appearanceDistance(seed.appearance,candidate.appearance)+.35*appearanceDistance(previous.appearance,candidate.appearance)
          return {index,cost:motion*.55+color*1.8+Math.abs(Math.log(scale(candidate.pose)/unit))*.25}
        }).sort((a,b)=>a.cost-b.cost)
        if(!ranked.length||ranked[0].cost>.85){uncertain.add(f);reasons.set(f,!ranked.length?'Биші анықталмады':'Таңдалған бишінің сәйкестігі күмәнді');break}
        if(ranked[1]&&ranked[1].cost-ranked[0].cost<.18){uncertain.add(f);reasons.set(f,'Бірнеше ұқсас биші анықталды');break}
        const next=frames[f].people[ranked[0].index]
        const n=center(next.pose)
        velocity={x:(n.x-c.x)*.65+velocity.x*.35,y:(n.y-c.y)*.65+velocity.y*.35}
        add(f,ranked[0].index);previous=next
      }
    }
  }
  const manual=new Map(validAnchors.map(a=>[a.frame,a.person]))
  let segment=0, wasValid=false
  return frames.map((frame,index)=>{
    const choices=votes.get(index)
    const selected=manual.has(index)?manual.get(index)!:choices?.size===1?[...choices][0]:undefined
    const state:TrackState=selected!==undefined?'tracked':choices?.size||uncertain.has(index)?'ambiguous':'lost'
    const pose=selected!==undefined?frame.people[selected].pose:null
    const valid=!!pose&&!poseIssue(pose)
    if(valid&&!wasValid)segment++
    wasValid=valid
    return {time:frame.time,pose,poseCount:pose?1:0,trackState:state,trackReason:reasons.get(index),segment,personIndex:selected}
  })
}

/** Coarse shirt/torso colour histogram; no face recognition or stored image. */
export function appearanceFromPixels(pose:Pose,pixels:ImageData):number[]{
  const histogram=Array(12).fill(0),{width,height,data}=pixels
  const poly=[11,12,24,23].map(i=>({x:pose[i].x*width,y:pose[i].y*height}))
  const inside=(x:number,y:number)=>{
    let result=false
    for(let i=0,j=3;i<4;j=i++)if((poly[i].y>y)!==(poly[j].y>y)&&x<(poly[j].x-poly[i].x)*(y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)result=!result
    return result
  }
  let count=0
  for(let y=Math.max(0,Math.floor(Math.min(...poly.map(p=>p.y))));y<Math.min(height,Math.ceil(Math.max(...poly.map(p=>p.y))));y++)
    for(let x=Math.max(0,Math.floor(Math.min(...poly.map(p=>p.x))));x<Math.min(width,Math.ceil(Math.max(...poly.map(p=>p.x))));x++){
      if(!inside(x,y))continue
      const k=(y*width+x)*4
      for(let c=0;c<3;c++)histogram[c*4+Math.min(3,Math.floor(data[k+c]/64))]++
      count++
    }
  return count?histogram.map(n=>n/count):[]
}

function samePosePerson(a:Pose,b:Pose):boolean {
  const ca=center(a),cb=center(b),unit=Math.min(scale(a),scale(b))
  const distance=Math.hypot(ca.x-cb.x,ca.y-cb.y)/unit
  if(distance>.75)return false
  const shared=[11,12,23,24,13,14,25,26,15,16,27,28].filter(i=>(a[i].visibility??0)>.5&&(b[i].visibility??0)>.5)
  if(shared.length<4)return false
  // Cropped views often return a shifted or incomplete skeleton for the same
  // person. Torso overlap is more stable than wrists and ankles during dance.
  const torsoDistance=torso.reduce((sum,i)=>sum+Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y),0)/4/unit
  const limbDistance=shared.reduce((sum,i)=>sum+Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y),0)/shared.length/unit
  return distance<.3&&torsoDistance<.4&&limbDistance<.85
}
export function deduplicatePoses(poses:Pose[]):Pose[]{
  const quality=(p:Pose)=>[11,12,13,14,15,16,23,24,25,26,27,28].reduce((s,i)=>s+(p[i].visibility??0),0)
  const result:Pose[]=[]
  for(const pose of [...poses].sort((a,b)=>quality(b)-quality(a))){
    if(!result.some(other=>samePosePerson(pose,other)))result.push(pose)
  }
  return result
}

/** Crop passes refine a full-frame detection; they must not create another
 * person inside an already detected torso. Keep the full-frame identity. */
export function mergeCropPoses(fullFrame:Pose[], cropped:Pose[]):Pose[]{
  const result=[...fullFrame]
  for(const candidate of deduplicatePoses(cropped)){
    const duplicate=result.some(existing=>{
      if(samePosePerson(existing,candidate))return true
      const unit=Math.min(scale(existing),scale(candidate))
      const a=center(existing),b=center(candidate)
      const torsoError=torso.reduce((sum,i)=>sum+Math.hypot(existing[i].x-candidate[i].x,existing[i].y-candidate[i].y),0)/4/unit
      const width=Math.max(Math.abs(existing[11].x-existing[12].x),Math.abs(existing[23].x-existing[24].x))
      return Math.abs(a.x-b.x)<width*.65&&Math.hypot(a.x-b.x,a.y-b.y)<unit*.65&&torsoError<.7
    })
    if(!duplicate)result.push(candidate)
  }
  return result
}
