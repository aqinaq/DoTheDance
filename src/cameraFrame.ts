/** The preview and model both use the same centered portrait window. */
export function portraitCrop(width:number,height:number){
  const w=Math.min(width,height*9/16),h=Math.min(height,width*16/9)
  return {x:(width-w)/2,y:(height-h)/2,width:w,height:h}
}
export function cameraFrame(video:HTMLVideoElement,canvas:HTMLCanvasElement){
  const crop=portraitCrop(video.videoWidth,video.videoHeight)
  if(canvas.width!==360||canvas.height!==640){canvas.width=360;canvas.height=640}
  canvas.getContext('2d')!.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,360,640)
  return canvas
}
