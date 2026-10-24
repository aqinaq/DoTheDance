import {describe,it,expect} from 'vitest'
import {portraitCrop} from './cameraFrame'
describe('portrait camera framing',()=>{
  it.each([[1920,1080],[960,720],[720,1280],[640,1600]])('centers a 9:16 crop inside %s x %s',(w,h)=>{
    const c=portraitCrop(w,h)
    expect(c.width/c.height).toBeCloseTo(9/16)
    expect(c.x+c.width/2).toBeCloseTo(w/2)
    expect(c.y+c.height/2).toBeCloseTo(h/2)
    expect(c.x).toBeGreaterThanOrEqual(0)
    expect(c.y).toBeGreaterThanOrEqual(0)
    expect(c.x+c.width).toBeLessThanOrEqual(w)
    expect(c.y+c.height).toBeLessThanOrEqual(h)
  })
})
