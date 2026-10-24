import { describe, expect, it } from 'vitest'
import { compare, poseIssue, type Pose } from './pose'
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
  it('төмен сенімді нүктелерді қабылдамайды',()=>{
    const p=person();p[15].visibility=.2
    expect(poseIssue(p)).toMatch(/сенімді/)
  })
  it('уақыт ығысуын бөлек бағалайды',()=>{
    const p=person();const r=compare([{time:1.5,pose:p}],p,1,0,1,1)
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
