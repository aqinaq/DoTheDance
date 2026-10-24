import { describe, expect, it } from 'vitest'
import { videoFileIssue } from './video'
const canPlay=(type:string)=>type==='video/mp4'?'probably':''
describe('видео файлын тексеру',()=>{
  it('қолданылмайтын форматты қабылдамайды',()=>expect(videoFileIssue({type:'video/avi',size:100},canPlay)).toMatch(/форматы/))
  it('үлкен файлды қабылдамайды',()=>expect(videoFileIssue({type:'video/mp4',size:201*1024*1024},canPlay)).toMatch(/200 МБ/))
  it('бос файлды қабылдамайды',()=>expect(videoFileIssue({type:'video/mp4',size:0},canPlay)).toMatch(/бос/))
  it('жарамды файлды қабылдайды',()=>expect(videoFileIssue({type:'video/mp4',size:1024},canPlay)).toBeNull())
})
