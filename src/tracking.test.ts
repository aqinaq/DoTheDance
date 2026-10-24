import { describe,expect,it } from 'vitest'
import { trackDancer,deduplicatePoses,type Detection,type DetectionFrame } from './tracking'
import { compare,type Pose } from './pose'
function person(x:number,color=0):Detection {
  const pose:Pose=Array.from({length:33},()=>({x,y:.35,z:0,visibility:1}))
  for(const [i,dx,y] of [[11,-.04,.3],[12,.04,.3],[13,-.07,.4],[14,.07,.4],[15,-.08,.5],[16,.08,.5],[23,-.03,.5],[24,.03,.5],[25,-.03,.65],[26,.03,.65],[27,-.03,.8],[28,.03,.8]])pose[i]={x:x+dx,y,z:0,visibility:1}
  return {pose,appearance:Array.from({length:12},(_,i)=>i%4===color?1:0)}
}
const frame=(time:number,...people:Detection[]):DetectionFrame=>({time,people})
describe('таңдалған бишіні бақылау',()=>{
  it('анықтау реті ауысса да сол бишіні сақтайды',()=>{
    const f=[frame(0,person(.25),person(.7,3)),frame(.125,person(.68,3),person(.27)),frame(.25,person(.3),person(.66,3))]
    expect(trackDancer(f,[{frame:0,person:0}]).map(s=>s.personIndex)).toEqual([0,1,0])
  })
  it('ұқсас кандидаттарда болжап таңдамайды',()=>{
    const f=[frame(0,person(.5)),frame(.125,person(.49),person(.51)),frame(.25,person(.52))]
    const s=trackDancer(f,[{frame:0,person:0}]);expect(s[1].pose).toBeNull();expect(s[2].pose).toBeNull()
  })
  it('жоғалғаннан кейін өздігінен басқа адамға өтпейді',()=>{
    const f=[frame(0,person(.5)),frame(.125),frame(.25,person(.51))]
    expect(trackDancer(f,[{frame:0,person:0}])[2].pose).toBeNull()
    expect(trackDancer(f,[{frame:0,person:0},{frame:2,person:0}])[2].pose).not.toBeNull()
  })
  it('киімі қатты өзгеше адамды қабылдамайды',()=>{
    expect(trackDancer([frame(0,person(.5)),frame(.125,person(.5,3))],[{frame:0,person:0}])[1].pose).toBeNull()
  })
  it('орталық кадрдан екі бағытта бақылайды',()=>{
    const f=[frame(0,person(.4)),frame(.125,person(.42)),frame(.25,person(.44))]
    expect(trackDancer(f,[{frame:1,person:0}]).every(s=>s.pose)).toBe(true)
  })
  it('қайталанған анықтауларды біріктіріп, бөлек бишілерді сақтайды',()=>{
    expect(deduplicatePoses([person(.3).pose,person(.301).pose,person(.65).pose])).toHaveLength(2)
  })
  it('айқасу алдында бақылауды тоқтатады',()=>{
    const f=[frame(0,person(.5),person(.57)),frame(.125,person(.51))]
    expect(trackDancer(f,[{frame:0,person:0}])[1].pose).toBeNull()
  })
  it('бір-біріне қайшы белгілер арасындағы адамды болжамайды',()=>{
    const f=[frame(0,person(.2),person(.8,3)),frame(.125,person(.2),person(.8,3)),frame(.25,person(.2),person(.8,3))]
    const s=trackDancer(f,[{frame:0,person:0},{frame:2,person:1}]);expect(s[1].pose).toBeNull();expect(s[0].personIndex).toBe(0);expect(s[2].personIndex).toBe(1)
  })
  it('бос аралыққа көрші кадрдан баға бермейді',()=>{
    const f=[frame(0,person(.5)),frame(.125),frame(.25,person(.5))]
    const samples=trackDancer(f,[{frame:0,person:0},{frame:2,person:0}])
    expect(compare(samples,person(.5).pose,.125,0,1,1)).toBeNull()
  })
})
