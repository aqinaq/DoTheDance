import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Pose } from './pose'
import { appearanceFromPixels, deduplicatePoses, mergeCropPoses, type DetectionFrame } from './tracking'

const version='0.10.35'
const wasm=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/wasm`
const model='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
let visionPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null=null
async function createLandmarker(numPoses: number, runningMode:'IMAGE'|'VIDEO') {
  visionPromise ||= FilesetResolver.forVisionTasks(wasm).catch(error=>{visionPromise=null;throw error})
  return PoseLandmarker.createFromOptions(await visionPromise,{baseOptions:{modelAssetPath:model,delegate:'CPU'},runningMode,numPoses,minPoseDetectionConfidence:numPoses>2?.4:.6,minPosePresenceConfidence:.5,minTrackingConfidence:.5})
}
export type DancerMode = 'single' | 'group'
export type Observation = { pose: Pose | null; poseCount: number; poses: Pose[] }
export type Detector = { detect: (video: HTMLVideoElement | HTMLCanvasElement, timestamp: number) => Observation; close: () => void }
export async function createDetector(numPoses = 2, runningMode:'IMAGE'|'VIDEO' = 'VIDEO'): Promise<Detector> {
  const landmarker=await createLandmarker(numPoses,runningMode)
  return {
    detect(video,timestamp) { const result=runningMode==='VIDEO'?landmarker.detectForVideo(video,timestamp):landmarker.detect(video); const poses=deduplicatePoses(result.landmarks as NormalizedLandmark[][]); return {pose:poses[0]??null,poseCount:poses.length,poses} },
    close(){landmarker.close()}
  }
}
function waitFor(el: HTMLVideoElement,event: string,signal: AbortSignal) {
  return new Promise<void>((resolve,reject)=>{
    if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return}
    const done=()=>{cleanup();resolve()}
    const fail=()=>{cleanup();reject(new Error('Видео оқылмады'))}
    const abort=()=>{cleanup();reject(new DOMException('Aborted','AbortError'))}
    const cleanup=()=>{el.removeEventListener(event,done);el.removeEventListener('error',fail);signal.removeEventListener('abort',abort)}
    el.addEventListener(event,done,{once:true});el.addEventListener('error',fail,{once:true});signal.addEventListener('abort',abort,{once:true})
  })
}
export async function analyzeVideo(url: string,start: number,end: number,signal: AbortSignal,onProgress:(n:number)=>void, dancerMode:DancerMode='single'):Promise<DetectionFrame[]> {
  const el=document.createElement('video'); el.muted=true;el.playsInline=true;el.preload='auto';el.src=url
  let detector:Detector|null=null
  try {
    if(el.readyState<1) await waitFor(el,'loadedmetadata',signal)
    if(el.readyState<2) await waitFor(el,'loadeddata',signal)
    detector=await createDetector(dancerMode==='single'?1:6,'IMAGE')
    const duration=end-start
    const count=Math.min(721,Math.max(2,Math.floor(duration*12)+1))
    const samples:DetectionFrame[]=[]
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=Math.round(320*el.videoHeight/el.videoWidth)
    const context=canvas.getContext('2d',{willReadFrequently:true})!
    const tile=document.createElement('canvas');const tileContext=tile.getContext('2d')!
    for(let i=0;i<count;i++) {
      if(signal.aborted) throw new DOMException('Aborted','AbortError')
      const t=start+duration*i/(count-1)
      if(Math.abs(el.currentTime-t)>.015){el.currentTime=t;await waitFor(el,'seeked',signal)}
      let poses=detector.detect(el,Math.round(t*1000)+i).poses
      // Only group videos need crop recovery. On solo videos, overlapping crops
      // can hallucinate several partial skeletons for one bent or occluded dancer.
      for(const left of dancerMode==='group'?[.02,.38]:[]){
        await new Promise<void>(r=>setTimeout(r,0))
        if(signal.aborted)throw new DOMException('Aborted','AbortError')
        const crop={x:left,y:.12,w:.6,h:.86}
        tile.width=Math.round(el.videoWidth*crop.w);tile.height=Math.round(el.videoHeight*crop.h)
        tileContext.drawImage(el,el.videoWidth*crop.x,el.videoHeight*crop.y,tile.width,tile.height,0,0,tile.width,tile.height)
        const extra=detector.detect(tile,0).poses.filter(p=>[11,12,23,24,27,28].every(j=>p[j].x>.025&&p[j].x<.975&&p[j].y>.025&&p[j].y<.975))
        poses=mergeCropPoses(poses,extra.map(p=>p.map(v=>({...v,x:crop.x+v.x*crop.w,y:crop.y+v.y*crop.h,z:v.z*crop.w}))))
      }
      context.drawImage(el,0,0,canvas.width,canvas.height)
      const pixels=context.getImageData(0,0,canvas.width,canvas.height)
      samples.push({time:t,people:deduplicatePoses(poses.filter(p=>[11,12,23,24].every(i=>(p[i]?.visibility??0)>.45))).slice(0,6).map(pose=>({pose,appearance:appearanceFromPixels(pose,pixels)}))})
      onProgress(Math.round((i+1)/count*100))
      await new Promise<void>(r=>setTimeout(r,0))
    }
    return samples
  } finally { detector?.close();el.removeAttribute('src');el.load() }
}
