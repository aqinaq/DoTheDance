import { describe, expect, it } from 'vitest'
import { moveEnd, moveStart } from './clip'
describe('үзіндіні таңдау',()=>{
  it('басты кейінге жылжытқанда ұзақтығын сақтайды',()=>expect(moveStart({start:0,end:12},198,90)).toEqual({start:90,end:102}))
  it('соңын алға жылжытқанда 60 секундтан асырмайды',()=>expect(moveEnd({start:0,end:12},198,100)).toEqual({start:40,end:100}))
  it('соңын бастан бұрын қоюға жол бермейді',()=>expect(moveEnd({start:80,end:92},198,20)).toEqual({start:8,end:20}))
})
