import type {Anchor,DetectionFrame} from './tracking'
export type Lesson = {name:string;start:number;end:number;duration:number;speed:number;videoMirror:boolean;cameraMirror:boolean;offset:number;repeat:boolean;detections:DetectionFrame[];anchors:Anchor[];selectionFrame:number}
export type LibraryItem={id:string;name:string;size:number;updated:number;hasMotion:boolean}
export type SavedLesson={id:string;lesson:Lesson;video:Blob}
let database:Promise<IDBDatabase>|undefined
function db(){
  return database??=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('do-the-dance-library',1)
    request.onupgradeneeded=()=>{for(const name of ['media','lessons','items','prefs'])request.result.createObjectStore(name)}
    request.onsuccess=()=>{const d=request.result;d.onversionchange=()=>{d.close();database=undefined};resolve(d)}
    request.onerror=()=>{database=undefined;reject(request.error)}
    request.onblocked=()=>{database=undefined;reject(new Error('Басқа ашық қойындыны жабыңыз.'))}
  })
}
const value=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
const done=(t:IDBTransaction)=>new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error||new Error('Сақтау тоқтатылды'));t.onerror=()=>reject(t.error)})
let queue:Promise<unknown>=Promise.resolve()
function write(action:(d:IDBDatabase)=>Promise<void>){const task=queue.then(async()=>action(await db()));queue=task.catch(()=>{});return task}
export async function libraryList(){await queue;const d=await db();return (await value<LibraryItem[]>(d.transaction('items').objectStore('items').getAll())).sort((a,b)=>b.updated-a.updated)}
export async function lastLesson(){await queue;const d=await db();return value<string|undefined>(d.transaction('prefs').objectStore('prefs').get('last'))}
export async function readLesson(id:string):Promise<SavedLesson|null>{
  await queue;const d=await db(),t=d.transaction(['lessons','media']);const [lesson,video]=await Promise.all([value<Lesson>(t.objectStore('lessons').get(id)),value<Blob>(t.objectStore('media').get(id))]);return lesson&&video?{id,lesson,video}:null
}
export function saveLesson(id:string,lesson:Lesson,size:number,video?:Blob){return write(async d=>{
  const t=d.transaction(['media','lessons','items','prefs'],'readwrite'),finished=done(t)
  if(video)t.objectStore('media').put(video,id)
  t.objectStore('lessons').put(lesson,id)
  t.objectStore('items').put({id,name:lesson.name,size,updated:Date.now(),hasMotion:lesson.detections.length>0},id)
  t.objectStore('prefs').put(id,'last')
  await finished
})}
export function removeLesson(id:string){return write(async d=>{
  const t=d.transaction(['media','lessons','items','prefs'],'readwrite'),finished=done(t)
  for(const store of ['media','lessons','items'])t.objectStore(store).delete(id)
  const last=t.objectStore('prefs').get('last');last.onsuccess=()=>{if(last.result===id)t.objectStore('prefs').delete('last')}
  await finished
})}
export function storageMessage(error:unknown){return (error as DOMException)?.name==='QuotaExceededError'?'Құрылғыда сақтау орны жеткіліксіз. Кітапханадан қажет емес видеоны өшіріп, қайта сақтаңыз.':'Браузерге сақтау мүмкін болмады. Жеке режимді немесе сақтау рұқсатын тексеріп, қайта көріңіз.'}
