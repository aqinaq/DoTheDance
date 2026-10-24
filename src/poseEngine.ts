import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Sample, Pose } from './pose'

const version='0.10.35'
const wasm=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/wasm`
const model='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
let visionPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null=null
async function createLandmarker(numPoses: number) {
  visionPromise ||= FilesetResolver.forVisionTasks(wasm)
  return PoseLandmarker.createFromOptions(await visionPromise,{baseOptions:{modelAssetPath:model,delegate:'CPU'},runningMode:'VIDEO',numPoses,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6})
}
export type Observation = { pose: Pose | null; poseCount: number }
export type Detector = { detect: (video: HTMLVideoElement, timestamp: number) => Observation; close: () => void }
export async function createDetector(numPoses = 2): Promise<Detector> {
  const landmarker=await createLandmarker(numPoses)
  return {
    detect(video,timestamp) { const result=landmarker.detectForVideo(video,timestamp); return {pose:(result.landmarks[0] as NormalizedLandmark[] | undefined) ?? null,poseCount:result.landmarks.length} },
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
export async function analyzeVideo(url: string,start: number,end: number,signal: AbortSignal,onProgress:(n:number)=>void):Promise<Sample[]> {
  const el=document.createElement('video'); el.muted=true;el.playsInline=true;el.preload='auto';el.src=url
  let detector:Detector|null=null
  try {
    if(el.readyState<1) await waitFor(el,'loadedmetadata',signal)
    if(el.readyState<2) await waitFor(el,'loadeddata',signal)
    detector=await createDetector(3)
    const duration=end-start
    const count=Math.min(241,Math.max(2,Math.floor(duration*4)+1))
    const samples:Sample[]=[]
    for(let i=0;i<count;i++) {
      if(signal.aborted) throw new DOMException('Aborted','AbortError')
      const t=start+duration*i/(count-1)
      if(Math.abs(el.currentTime-t)>.015){el.currentTime=t;await waitFor(el,'seeked',signal)}
      const observation=detector.detect(el,Math.round(t*1000)+i) // strictly increasing timestamps
      samples.push({time:t,pose:observation.pose,poseCount:observation.poseCount})
      onProgress(Math.round((i+1)/count*100))
      if(i%3===0) await new Promise<void>(r=>setTimeout(r,0))
    }
    return samples
  } finally { detector?.close();el.removeAttribute('src');el.load() }
}
