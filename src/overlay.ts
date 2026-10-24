import {drawPose, nearestSample, poseIssue, reflectPose, type Pose, type Sample} from './pose'

/** Place the timed reference on the user's hip center and torso scale, in camera coordinates. */
export function targetOnCamera(samples:Sample[],current:Pose|null,time:number,refAspect:number,camAspect:number,videoMirror:boolean,cameraMirror:boolean):Pose|null {
  if(!current||poseIssue(current)||!Number.isFinite(refAspect)||refAspect<=0||!Number.isFinite(camAspect)||camAspect<=0)return null
  const sample=nearestSample(samples,time)
  if(!sample?.pose||poseIssue(sample.pose,sample.poseCount)||sample.trackState==='lost'||sample.trackState==='ambiguous'||Math.abs(sample.time-time)>.2)return null
  const reference=videoMirror!==cameraMirror?reflectPose(sample.pose):sample.pose
  const body=(p:Pose,aspect:number)=>{
    const x=(p[23].x+p[24].x)/2*aspect,y=(p[23].y+p[24].y)/2
    return {x,y,size:Math.hypot((p[11].x+p[12].x)/2*aspect-x,(p[11].y+p[12].y)/2-y)}
  }
  const from=body(reference,refAspect),to=body(current,camAspect)
  if(from.size<.03||to.size<.03)return null
  const scale=to.size/from.size
  return reference.map(p=>({...p,x:((p.x*refAspect-from.x)*scale+to.x)/camAspect,y:(p.y-from.y)*scale+to.y}))
}
export function drawCameraOverlay(canvas:HTMLCanvasElement|null,current:Pose|null,target:Pose|null,mirrored:boolean,highlight:number[]=[]){
  // Wider dashed purple target remains distinguishable even when poses coincide.
  drawPose(canvas,target,mirrored,[],360,640,{color:'#c4a2ff',dashed:true})
  drawPose(canvas,current,mirrored,highlight,360,640,{color:'#a6f0d3',overlay:true})
}
