import { describe, expect, it } from 'vitest'
import { compare, reflectPose, poseIssue, type Pose } from './pose'
import { summarize } from './results'

function person():Pose {
  const p=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1,presence:1}))
  const assign=(i:number,x:number,y:number)=>{p[i]={x,y,z:0,visibility:1,presence:1}}
  assign(11,.42,.30);assign(12,.58,.30);assign(13,.34,.43);assign(14,.66,.43);assign(15,.29,.57);assign(16,.71,.57)
  assign(23,.44,.53);assign(24,.56,.53);assign(25,.43,.72);assign(26,.57,.72);assign(27,.42,.91);assign(28,.58,.91)
  return p
}

describe('қимылды салыстыру',()=>{
  it('анық және ұқсас қалыпқа жоғары шынайы баға береді',()=>{
    const p=person();const r=compare([{time:1,pose:p}],p,1,0,16/9,16/9)
    expect(r?.poseScore).toBe(100);expect(r?.timingScore).toBe(100)
  })
  it('кадрдан шыққан аяққа баға шығармайды',()=>{
    const p=person();p[27].x=.99
    expect(poseIssue(p)).toMatch(/кадрдан/)
    expect(compare([{time:1,pose:person()}],p,1,0,1,1)).toBeNull()
  })
  it('бір жабылған білезікті есептен шығарып, қалған қимылды бағалайды',()=>{
    const p=person();p[15].visibility=.2
    expect(poseIssue(p)).toBeNull()
    expect(compare([{time:1,pose:person()}],p,1,0,1,1)?.poseScore).toBe(100)
  })
  it('көп нүкте жабылса баға шығармайды',()=>{
    const p=person();for(const i of [13,14,15,16])p[i].visibility=.2
    expect(poseIssue(p)).toMatch(/сенімді/)
    expect(compare([{time:1,pose:person()}],p,1,0,1,1)).toBeNull()
  })
  it('бір кадрдағы бірнеше адамға баға шығармайды',()=>{
    const p=person()
    expect(poseIssue(p,2)).toMatch(/бірнеше адам/)
    expect(compare([{time:1,pose:p,poseCount:2}],p,1,0,1,1)).toBeNull()
  })
  it('уақыт ығысуын бөлек бағалайды',()=>{
    const p=person();const early=person();early[15].y=.3;const r=compare([{time:1,pose:early},{time:1.5,pose:p}],p,1,0,1,1)
    expect(r?.poseScore).toBe(100);expect(r?.timingScore).toBeLessThan(100)
  })
})

describe('қорытынды',()=>{
  it('дерек жеткіліксіз болса нәтиже құрмайды',()=>{expect(summarize([{time:1,comparison:null}],'би')).toBeNull()})
  it('жарамды кадр үлесін жоғалтпайды',()=>{
    const p=person();const c=compare([{time:1,pose:p}],p,1,0,1,1)!
    const frames=[{time:1,comparison:c},{time:1.2,comparison:c},{time:1.4,comparison:c},{time:1.6,comparison:null}]
    const s=summarize(frames,'би')!
    expect(s.valid).toBe(3);expect(s.total).toBe(4);expect(s.score).toBe(100)
  })
})

describe('independent mirror settings',()=>{
  const asymmetric=()=>{const p=person();p[13].y=.24;p[15].y=.12;return p}
  it.each([[false,false],[true,true],[true,false],[false,true]])('matches displayed pose: camera %s, source %s',(cameraMirror,videoMirror)=>{
    const p=asymmetric()
    const camera=cameraMirror!==videoMirror?reflectPose(p):p
    expect(compare([{time:1,pose:p}],camera,1,0,1,1,cameraMirror,videoMirror)?.poseScore).toBe(100)
    expect(compare([{time:1,pose:p}],camera,1,0,1,1,cameraMirror,videoMirror)?.highlight).toEqual([])
  })
  it('does not reward the wrong side in opposite mirror modes',()=>{
    const p=asymmetric()
    expect(compare([{time:1,pose:p}],p,1,0,1,1,true,false)!.poseScore).toBeLessThan(90)
  })
  it('preserves input and is reversible',()=>{
    const p=asymmetric(),saved=JSON.stringify(p)
    const reflected=reflectPose(p)
    expect(reflected[16].y).toBe(p[15].y)
    expect(reflectPose(reflected)[15].x).toBeCloseTo(p[15].x)
    expect(JSON.stringify(p)).toBe(saved)
  })
})
