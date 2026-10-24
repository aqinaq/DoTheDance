import { useEffect, useRef, useState } from 'react'
import { bounds, type DetectionFrame } from './tracking'
export function DancerPicker({frame,width,height,mirror,selected,onSelect}:{frame:DetectionFrame;width:number;height:number;mirror:boolean;selected?:number;onSelect:(person:number)=>void}){
  const ref=useRef<HTMLDivElement>(null)
  const [size,setSize]=useState({width:0,height:0})
  useEffect(()=>{const el=ref.current!;const ro=new ResizeObserver(()=>setSize({width:el.clientWidth,height:el.clientHeight}));ro.observe(el);return()=>ro.disconnect()},[])
  const scale=Math.min(size.width/(width||1),size.height/(height||1)),w=width*scale,h=height*scale
  return <div className="dancer-picker" ref={ref} aria-label="Видеодан бишіні таңдау">{frame.people.map((person,index)=>{
    const box=bounds(person.pose)
    return <button key={index} aria-label={`Биші ${index+1}`} aria-pressed={selected===index} onClick={()=>onSelect(index)} style={{left:(size.width-w)/2+(mirror?1-box.right:box.left)*w,top:(size.height-h)/2+box.top*h,width:Math.max(24,(box.right-box.left)*w),height:Math.max(32,(box.bottom-box.top)*h)}}><span>{index+1}{selected===index?' ✓':''}</span></button>
  })}</div>
}
