import { describe, expect, it } from 'vitest'
import { moveEnd, moveStart, practiceClip } from './clip'
describe('үзіндіні таңдау',()=>{
  it('басты кейінге жылжытқанда ұзақтығын сақтайды',()=>expect(moveStart({start:0,end:12},198,90)).toEqual({start:90,end:102}))
  it('соңын алға жылжытқанда 60 секундтан асырмайды',()=>expect(moveEnd({start:0,end:12},198,100)).toEqual({start:40,end:100}))
  it('соңын бастан бұрын қоюға жол бермейді',()=>expect(moveEnd({start:80,end:92},198,20)).toEqual({start:8,end:20}))
})
describe('difficult section practice',()=>{
  it('stays inside the analysis when a score bucket starts before a fractional clip boundary',()=>expect(practiceClip({start:10.8,end:25},9)).toEqual({start:10.8,end:13.8}))
  it('keeps at least half a second at the end of a clip',()=>expect(practiceClip({start:10,end:25},25)).toEqual({start:24.5,end:25}))
  it('selects a three second loop without extending the analysis',()=>expect(practiceClip({start:10,end:25},15)).toEqual({start:15,end:18}))
})
