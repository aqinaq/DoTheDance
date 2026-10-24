export const MAX_VIDEO_BYTES=200*1024*1024
export function videoFileIssue(file:Pick<File,'type'|'size'>,canPlayType:(type:string)=>string):string|null {
  if(!file.type.startsWith('video/')||!canPlayType(file.type)) return 'Бұл видео форматы браузерде ойнатылмайды. MP4 немесе WebM таңдаңыз.'
  if(file.size>MAX_VIDEO_BYTES) return 'Видео көлемі 200 МБ-тан аспауы керек.'
  if(file.size===0) return 'Видео файлы бос. Басқа файл таңдаңыз.'
  return null
}
