import {describe,it,expect} from 'vitest'
import {targetOnCamera} from './overlay'
import {reflectPose,type Pose,type Sample} from './pose'
function person():Pose{
  const p=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1,presence:1}))
  for(const [i,x,y] of [[11,.4,.3],[12,.6,.3],[13,.33,.43],[14,.67,.43],[15,.3,.55],[16,.7,.55],[23,.43,.53],[24,.57,.53],[25,.43,.7],[26,.57,.7],[27,.42,.9],[28,.58,.9]])p[i]={x,y,z:0,visibility:1,presence:1}
  return p
}
describe('timed target overlay',()=>{
  it('fits reference torso to user position and size without copying user arm motion',()=>{
    const ref=person();ref[15].y=.15
    const current=person().map(p=>({...p,x:(p.x-.5)*.7+.55,y:(p.y-.53)*.7+.5}))
    const target=targetOnCamera([{time:1,pose:ref}],current,1,1,1,false,false)!
    expect(target[23].x).toBeCloseTo(current[23].x)
    expect(target[23].y).toBeCloseTo(current[23].y)
    expect(target[15].y).toBeCloseTo((.15-.53)*.7+.5)
    expect(target[15].y).toBeLessThan(current[15].y)
  })
  it.each([[false,false],[true,true],[true,false],[false,true]])('aligns sides for video %s and camera %s',(videoMirror,cameraMirror)=>{
    const ref=person();ref[15].y=.15
    const current=videoMirror!==cameraMirror?reflectPose(ref):ref
    const target=targetOnCamera([{time:1,pose:ref}],current,1,1,1,videoMirror,cameraMirror)!
    expect(target[15].y).toBeCloseTo(current[15].y)
    expect(target[16].y).toBeCloseTo(current[16].y)
  })
  it('accounts for landscape source and portrait camera aspect ratios',()=>{
    const ref=person(),ratio=(16/9)/(9/16)
    const current=ref.map(p=>({...p,x:.5+(p.x-.5)*ratio*.5,y:.53+(p.y-.53)*.5}))
    const target=targetOnCamera([{time:1,pose:ref}],current,1,16/9,9/16,false,false)!
    expect(target[15].x).toBeCloseTo(current[15].x)
    expect(target[15].y).toBeCloseTo(current[15].y)
  })
  it('does not bridge lost, ambiguous, or stale reference frames',()=>{
    const p=person()
    for(const sample of [{time:1,pose:null},{time:1,pose:p,trackState:'lost'},{time:1,pose:p,trackState:'ambiguous'},{time:0,pose:p}] as Sample[]){
      expect(targetOnCamera([sample],p,1,1,1,false,false)).toBeNull()
    }
  })
  it('hides target when user or reference is unreliable',()=>{
    const p=person(),low=person();low[15].visibility=.1
    expect(targetOnCamera([{time:1,pose:p}],null,1,1,1,false,false)).toBeNull()
    expect(targetOnCamera([{time:1,pose:p}],low,1,1,1,false,false)).toBeNull()
    expect(targetOnCamera([{time:1,pose:low}],p,1,1,1,false,false)).toBeNull()
  })
})
