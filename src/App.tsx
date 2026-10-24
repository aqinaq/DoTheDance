import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertCircle, ArrowRight, Camera, ChevronRight, History, Info, Pause, Play, RotateCcw, ShieldCheck, Sparkles, Timer, Trash2, UploadCloud, Video, Volume2, VolumeX, X } from 'lucide-react'
import { analyzeVideo, createDetector, type Detector } from './poseEngine'
import { compare, drawPose, nearestSample, poseIssue, type Comparison, type Pose, type Sample } from './pose'
import { clearHistory, getHistory, saveSummary, summarize, type FrameResult, type Summary } from './results'
import { videoFileIssue } from './video'
import { moveEnd, moveStart } from './clip'
import { trackDancer, type DetectionFrame, type Anchor } from './tracking'
import { DancerPicker } from './DancerPicker'
import './style.css'

type Phase='empty'|'loaded'|'analyzing'|'ready'|'countdown'|'practicing'|'paused'|'finished'|'insufficient'|'error'|'selecting'
const fmt=(s:number)=>`${Math.floor(Math.max(0,s)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,s)%60).toString().padStart(2,'0')}`

export default function App(){
  const [tab,setTab]=useState<'studio'|'history'>('studio')
  const [fileName,setFileName]=useState('')
  const [url,setUrl]=useState('')
  const urlRef=useRef('')
  const [duration,setDuration]=useState(0)
  const [start,setStart]=useState(0)
  const [end,setEnd]=useState(0)
  const [playhead,setPlayhead]=useState(0)
  const [playing,setPlaying]=useState(false)
  const [muted,setMuted]=useState(false)
  const [speed,setSpeed]=useState(1)
  const [repeat,setRepeat]=useState(false)
  const [videoMirror,setVideoMirror]=useState(false)
  const [cameraMirror,setCameraMirror]=useState(true)
  const [offset,setOffset]=useState(0)
  const [phase,setPhase]=useState<Phase>('empty')
  const [progress,setProgress]=useState(0)
  const [modelStatus,setModelStatus]=useState('Модель жүктелмеген')
  const [error,setError]=useState('')
  const [cameraOn,setCameraOn]=useState(false)
  const [cameraIssue,setCameraIssue]=useState('')
  const [countdown,setCountdown]=useState(0)
  const [live,setLive]=useState<Comparison|null>(null)
  const [summary,setSummary]=useState<Summary|null>(null)
  const [history,setHistory]=useState<Summary[]>(getHistory)
  const [validSamples,setValidSamples]=useState(0)
  const [sourceReady,setSourceReady]=useState(false)
  const [detections,setDetections]=useState<DetectionFrame[]>([])
  const [anchors,setAnchors]=useState<Anchor[]>([])
  const [selectionFrame,setSelectionFrame]=useState(0)
  const [showPicker,setShowPicker]=useState(false)
  const [referenceNotice,setReferenceNotice]=useState('')
  const videoRef=useRef<HTMLVideoElement>(null)
  const cameraRef=useRef<HTMLVideoElement>(null)
  const videoCanvasRef=useRef<HTMLCanvasElement>(null)
  const cameraCanvasRef=useRef<HTMLCanvasElement>(null)
  const fileInputRef=useRef<HTMLInputElement>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const detectorRef=useRef<Detector|null>(null)
  const samplesRef=useRef<Sample[]>([])
  const framesRef=useRef<FrameResult[]>([])
  const abortRef=useRef<AbortController|null>(null)
  const sessionRef=useRef(0)
  const lastCameraPoseRef=useRef<Pose|null>(null)
  const cueAtRef=useRef(0)
  const cueRef=useRef('')
  const finishingRef=useRef(false)

  const stopCamera=useCallback(()=>{
    streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null
    detectorRef.current?.close();detectorRef.current=null
    if(cameraRef.current) cameraRef.current.srcObject=null
    drawPose(cameraCanvasRef.current,null,false)
    setCameraOn(false);setCameraIssue('');lastCameraPoseRef.current=null
  },[])
  const reset=useCallback(()=>{
    sessionRef.current++;abortRef.current?.abort();abortRef.current=null
    videoRef.current?.pause();stopCamera()
    setDetections([]);setAnchors([]);setShowPicker(false);setReferenceNotice('')
    samplesRef.current=[];framesRef.current=[];setLive(null);setSummary(null);setValidSamples(0);setSourceReady(false);setProgress(0);setModelStatus('Модель жүктелмеген')
    setPlayhead(0);setPlaying(false);setCountdown(0);setError('');setOffset(0)
    drawPose(videoCanvasRef.current,null,videoMirror)
  },[stopCamera,videoMirror])
  useEffect(()=>()=>{sessionRef.current++;abortRef.current?.abort();streamRef.current?.getTracks().forEach(t=>t.stop());detectorRef.current?.close();if(urlRef.current)URL.revokeObjectURL(urlRef.current)},[])
  useEffect(()=>{const handler=()=>{streamRef.current?.getTracks().forEach(t=>t.stop())};window.addEventListener('pagehide',handler);return()=>window.removeEventListener('pagehide',handler)},[])
  useEffect(()=>{
    const canvases=[videoCanvasRef.current,cameraCanvasRef.current]
    const ro=new ResizeObserver(()=>{
      canvases.forEach(c=>{if(c){c.width=c.clientWidth*devicePixelRatio;c.height=c.clientHeight*devicePixelRatio}})
      const video=videoRef.current,camera=cameraRef.current,sample=nearestSample(samplesRef.current,video?.currentTime??0)
      drawPose(videoCanvasRef.current,sample&&!poseIssue(sample.pose,sample.poseCount)?sample.pose:null,videoMirror,[],video?.videoWidth,video?.videoHeight)
      drawPose(cameraCanvasRef.current,lastCameraPoseRef.current,cameraMirror,[],camera?.videoWidth,camera?.videoHeight)
    })
    canvases.forEach(c=>{if(c){ro.observe(c);c.width=c.clientWidth*devicePixelRatio;c.height=c.clientHeight*devicePixelRatio}})
    return()=>ro.disconnect()
  },[tab,videoMirror,cameraMirror])
  const drawReference=useCallback((time:number)=>{
    const el=videoRef.current
    const sample=nearestSample(samplesRef.current,time)
    drawPose(videoCanvasRef.current,sample&&!poseIssue(sample.pose,sample.poseCount)?sample.pose:null,videoMirror,[],el?.videoWidth,el?.videoHeight)
  },[videoMirror])
  useEffect(()=>{drawReference(videoRef.current?.currentTime??0);drawPose(cameraCanvasRef.current,lastCameraPoseRef.current,cameraMirror,live?.highlight,cameraRef.current?.videoWidth,cameraRef.current?.videoHeight)},[videoMirror,cameraMirror,live,drawReference])

  useEffect(()=>{cueRef.current='';cueAtRef.current=0;setLive(null)},[videoMirror,cameraMirror])

  function loadFile(file?:File){
    if(!file)return
    reset()
    if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=''}
    setUrl('');setFileName('');setDuration(0);setStart(0);setEnd(0)
    const probe=document.createElement('video')
    const issue=videoFileIssue(file,type=>probe.canPlayType(type))
    if(issue){setError(issue);setPhase('error');return}
    const next=URL.createObjectURL(file);urlRef.current=next;setUrl(next);setFileName(file.name);setPhase('loaded')
  }
  function onMetadata(){
    const d=videoRef.current?.duration||0
    if(!Number.isFinite(d)||d<.5){setError('Видео тым қысқа немесе ұзақтығы анықталмады. Басқа файл таңдаңыз.');setPhase('error');return}
    if(videoRef.current)videoRef.current.playbackRate=speed
    setDuration(d);setStart(0);setEnd(Math.min(60,d));setPlayhead(0)
  }
  function onVideoError(){if(url){setError('Видео ойнатылмады. Файлды тексеріп, қайта жүктеңіз.');setPhase('error')}}
  async function analyze(){
    if(!url||!duration)return
    abortRef.current?.abort();const ctrl=new AbortController();abortRef.current=ctrl
    const id=++sessionRef.current
    setCountdown(0);setPhase('analyzing');setProgress(0);setError('');setModelStatus('Модель жүктелуде…');setLive(null);setSummary(null);setSourceReady(false)
    try{
      videoRef.current?.pause()
      const frames=await analyzeVideo(url,start,end,ctrl.signal,n=>{if(n>0)setModelStatus('Бишілер талданып жатыр');setProgress(n)})
      if(id!==sessionRef.current)return
      setDetections(frames);setAnchors([]);samplesRef.current=[];setValidSamples(0)
      const best=frames.reduce((best,f,i)=>f.people.filter(p=>!poseIssue(p.pose)).length>frames[best].people.filter(p=>!poseIssue(p.pose)).length?i:best,0)
      const index=frames[best].people.length?best:frames.findIndex(f=>f.people.length)
      if(index<0){setPhase('insufficient');setModelStatus('Биші анықталмады');setError('Бұл үзіндіде биші анықталмады. Жақынырақ, жарығы жақсы үзінді таңдаңыз.');return}
      setSelectionFrame(index);setShowPicker(true);setPhase('selecting');setModelStatus('Үйренетін бишіні таңдаңыз')
      if(videoRef.current){videoRef.current.currentTime=frames[index].time;setPlayhead(frames[index].time);videoRef.current.scrollIntoView({behavior:'smooth',block:'center'})}

    }catch(e){if((e as Error).name==='AbortError')return;setPhase('error');setModelStatus('Модель қатесі');setError('Қимылды тану моделі жүктелмеді немесе видео талданбады. Интернетті тексеріп, қайта көріңіз.')}
  }
  function selectDancer(person:number){
    const next=[...anchors.filter(a=>a.frame!==selectionFrame),{frame:selectionFrame,person}]
    const samples=trackDancer(detections,next)
    const good=samples.filter(s=>!poseIssue(s.pose)).length
    setAnchors(next);samplesRef.current=samples;setValidSamples(good);setSummary(null);setLive(null);framesRef.current=[]
    setSourceReady(good>=3);setShowPicker(false);setError('')
    setPhase(good>=3?'ready':'insufficient')
    setModelStatus(`Биші таңдалды · ${Math.round(good/samples.length*100)}% жарамды кадр`)
    if(good<3)setError('Бақылауға жарамды кадр аз. Биші анық көрінетін келесі кадрда қайта белгілеңіз.')
    drawReference(detections[selectionFrame].time)
  }
  function selectFrame(index:number){
    setSelectionFrame(index)
    const v=videoRef.current
    if(v){v.pause();v.currentTime=detections[index].time;setPlayhead(detections[index].time)}
  }
  function reopenPicker(){
    videoRef.current?.pause();setPhase('selecting');setShowPicker(true);setLive(null)
    const time=videoRef.current?.currentTime??start
    const nearest=detections.reduce((best,f,i)=>Math.abs(f.time-time)<Math.abs(detections[best].time-time)?i:best,0)
    selectFrame(nearest);videoRef.current?.scrollIntoView({behavior:'smooth',block:'center'})
  }
  async function startCamera(){
    setCameraIssue('')
    if(!navigator.mediaDevices?.getUserMedia){setCameraIssue('Камера тек HTTPS немесе localhost бетінде іске қосылады.');return}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:720}},audio:false})
      streamRef.current=stream
      const el=cameraRef.current
      if(el){el.srcObject=stream;await el.play()}
      setModelStatus('Камера моделі жүктелуде…')
      detectorRef.current=await createDetector()
      setModelStatus('Модель дайын');setCameraOn(true)
    }catch(e){
      streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null
      const name=(e as DOMException).name
      setCameraIssue(name==='NotAllowedError'?'Камера рұқсаты берілмеді. Браузер баптауынан рұқсат беріп, қайталап көріңіз.':name==='NotFoundError'?'Камера табылмады. Құрылғыны қосып, қайталап көріңіз.':'Камера немесе қимылды тану моделі іске қосылмады. Қайта көріңіз.')
      setModelStatus('Камера қатесі')
    }
  }
  async function begin(){
    if(!cameraOn||!sourceReady||!samplesRef.current.length||!videoRef.current)return
    const id=++sessionRef.current
    setLive(null);setSummary(null);framesRef.current=[];finishingRef.current=false;setPhase('countdown')
    videoRef.current.pause();videoRef.current.currentTime=start
    for(let n=3;n>=1;n--){setCountdown(n);await new Promise(r=>setTimeout(r,1000));if(id!==sessionRef.current)return}
    setCountdown(0);setPhase('practicing');try{await videoRef.current.play()}catch{setPhase('paused');setError('Видео ойнатылмады. Ойнату түймесін басып, қайта көріңіз.')}
  }
  async function resume(){try{await videoRef.current?.play();setPhase('practicing')}catch{setError('Видео ойнатылмады. Ойнату рұқсатын тексеріңіз.')}}
  function pause(){videoRef.current?.pause();setPhase('paused')}
  function finish(){
    if(finishingRef.current)return
    finishingRef.current=true
    sessionRef.current++;videoRef.current?.pause();setPlaying(false)
    const result=summarize(framesRef.current,fileName)
    if(result){setSummary(result);saveSummary(result);setHistory(getHistory());setPhase('finished')}
    else{setPhase('insufficient');setError('Бағалау үшін дерек жеткіліксіз. Толық денеңізбен кадрда тұрып, қайта жаттығыңыз.')}
  }
  function retryDifficult(){
    if(!summary?.difficult.length)return
    const t=Math.max(start,summary.difficult[0].time)
    setStart(t);setEnd(Math.min(end,t+10));videoRef.current!.currentTime=t;setPhase('ready');setSummary(null);setLive(null);framesRef.current=[];finishingRef.current=false
  }
  function changeSegment(nextStart:number,nextEnd:number){
    abortRef.current?.abort();sessionRef.current++;videoRef.current?.pause()
    setDetections([]);setAnchors([]);setShowPicker(false);setReferenceNotice('');setError('');setModelStatus('Үзіндіні талдаңыз')
    samplesRef.current=[];framesRef.current=[];setValidSamples(0);setSourceReady(false);setSummary(null);setLive(null)
    setCountdown(0);setStart(nextStart);setEnd(nextEnd);setPhase('loaded');setProgress(0)
    drawPose(videoCanvasRef.current,null,videoMirror)
  }
  function openHistory(){
    if(phase==='countdown'){sessionRef.current++;setCountdown(0);setPhase('ready')}
    if(phase==='practicing'||phase==='paused')finish()
    stopCamera();setTab('history')
  }
  function onTimeUpdate(){
    const v=videoRef.current;if(!v)return
    setPlayhead(v.currentTime);drawReference(v.currentTime)
    if(showPicker)return
    if(v.currentTime>=end-.04&&end>start){
      if(repeat){v.currentTime=start;drawReference(start)}
      else if(phase==='practicing')finish()
      else{v.pause();setPlaying(false)}
    }
  }
  useEffect(()=>{
    if(phase!=='practicing')return
    let raf=0,last=0
    const tick=(now:number)=>{
      const cam=cameraRef.current,vid=videoRef.current,detector=detectorRef.current
      if(now-last>=125&&cam&&vid&&detector&&cam.readyState>=2&&vid.readyState>=2&&!vid.paused&&!vid.seeking){
        last=now
        try{
          const observation=detector.detect(cam,now)
          const pose=observation.pose
          const issue=poseIssue(pose,observation.poseCount);lastCameraPoseRef.current=issue?null:pose;setCameraIssue(issue||'')
          const reference=nearestSample(samplesRef.current,vid.currentTime+offset)
          setReferenceNotice(!reference?.pose?'Таңдалған биші көрінбейді немесе бақылау күмәнді. Бұл кадр бағаланбайды.':poseIssue(reference.pose)?'Үлгідегі дене нүктелері анық емес. Бұл кадр бағаланбайды.':'')
          const result=!issue&&pose?compare(samplesRef.current,pose,vid.currentTime,offset,vid.videoWidth/vid.videoHeight,cam.videoWidth/cam.videoHeight,cameraMirror,videoMirror):null
          framesRef.current.push({time:vid.currentTime,comparison:result})
          if(result){
            if(now-cueAtRef.current>1800||!cueRef.current){cueRef.current=result.cue;cueAtRef.current=now}
            setLive({...result,cue:cueRef.current})
          }else setLive(null)
          drawPose(cameraCanvasRef.current,issue?null:pose,cameraMirror,result?.highlight||[],cam.videoWidth,cam.videoHeight)
          drawReference(vid.currentTime)
        }catch{setCameraIssue('Камера кадры талданбады. Жаттығуды қайта бастаңыз.');pause();return}
      }
      raf=requestAnimationFrame(tick)
    }
    raf=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(raf)
  },[phase,offset,videoMirror,cameraMirror,drawReference])
  useEffect(()=>{
    if(!cameraOn||phase==='practicing'||phase==='countdown')return
    let raf=0,last=0
    const tick=(now:number)=>{
      const cam=cameraRef.current,detector=detectorRef.current
      if(now-last>=180&&cam&&detector&&cam.readyState>=2){
        last=now
        try{const observation=detector.detect(cam,now);const pose=observation.pose;const issue=poseIssue(pose,observation.poseCount);lastCameraPoseRef.current=issue?null:pose;setCameraIssue(issue||'');drawPose(cameraCanvasRef.current,issue?null:pose,cameraMirror,[],cam.videoWidth,cam.videoHeight)}catch{setCameraIssue('Камера кадры талданбады. Камераны қайта қосыңыз.');return}
      }
      raf=requestAnimationFrame(tick)
    }
    raf=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(raf)
  },[cameraOn,phase,cameraMirror])
  const canPractice=sourceReady&&['ready','paused','finished','insufficient'].includes(phase)&&validSamples>0
  const statusLabel=phase==='selecting'?'Бишіні таңдаңыз':phase==='analyzing'?`Талдануда · ${progress}%`:phase==='practicing'?'Жаттығу жүріп жатыр':phase==='countdown'?'Дайындалу':phase==='ready'?'Жаттығуға дайын':phase==='finished'?'Сабақ аяқталды':phase==='insufficient'?'Дерек жеткіліксіз':phase==='error'?'Қате':phase==='loaded'?'Видео жүктелді':'Видеоны жүктеңіз'
  const readyToAnalyze=!!url&&duration>0&&end>start&&end-start<=60&&phase!=='analyzing'

  return <div className="app">
    <header className="topbar"><div className="topbar-inner">
      <button className="brand" onClick={()=>setTab('studio')} aria-label="Басты бет"><span className="brand-mark"><Activity size={19} strokeWidth={2.8}/></span><span>do the <b>dance</b><span className="brand-dot">.</span></span></button>
      <nav className="nav"><button className={tab==='studio'?'active':''} onClick={()=>setTab('studio')}>Студия</button><button className={tab==='history'?'active':''} onClick={openHistory}>Нәтижелер тарихы</button></nav>
      <span className="private-pill"><ShieldCheck size={15}/> Бәрі браузерде</span>
    </div></header>
    <main className="container" hidden={tab!=='studio'}>
      <section className="hero"><div><div className="eyebrow"><span className="eyebrow-dot"/> СЕНІҢ ЖЕКЕ БИ СТУДИЯҢ</div><h1>Қимылыңды сез.<br/><span>Биіңді дамыт.</span></h1><p>Өзің ұнатқан биді жүкте, камера алдында қайтала. Біз қимылыңды салыстырып, нақты қай жерін жақсартуға болатынын көрсетеміз.</p></div><div className="hero-art" aria-hidden="true"><div className="art-disc"><span className="art-arc arc-one"/><span className="art-arc arc-two"/><span className="art-person"><span className="art-head"/><span className="art-body"/><span className="art-arm left"/><span className="art-arm right"/><span className="art-leg left"/><span className="art-leg right"/></span></div><div className="art-chip"><Sparkles size={17}/> Өз ырғағыңмен үйрен</div></div></section>
      <section className="steps" aria-label="Үш қадам"><div><span>01</span><b>Видео жүкте</b><small>Үйренетін биіңді таңда</small></div><ChevronRight size={18}/><div><span>02</span><b>Қимылды қайтала</b><small>Камера алдында биле</small></div><ChevronRight size={18}/><div><span>03</span><b>Нәтижеңді көр</b><small>Қай тұсты түзету керегін біл</small></div></section>
      <div className="section-heading"><div><div className="section-kicker">ЖАТТЫҒУ АЛАҢЫ</div><h2>Би студиясы</h2><small className="model-label">{modelStatus}</small></div><div className={`status-badge ${phase}`}><span/>{statusLabel}</div></div>
      {(error||cameraIssue)&&<div className="notice error-notice" role="alert"><AlertCircle size={18}/><span>{error||cameraIssue}</span><button onClick={()=>{setError('');setCameraIssue('')}} aria-label="Хабарламаны жабу"><X size={16}/></button></div>}
      <div className="studio-grid">
        <div className="media-card"><div className="card-head"><div className="card-icon purple"><Video size={18}/></div><div><h3>Үлгі видео</h3><p>Қайталайтын биің</p></div><span className="card-tag">ҮЛГІ</span></div>
          <div className="stage"><video ref={videoRef} src={url||undefined} playsInline muted={muted} onLoadedMetadata={onMetadata} onError={onVideoError} onTimeUpdate={onTimeUpdate} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} style={{transform:videoMirror?'scaleX(-1)':undefined}}/><canvas ref={videoCanvasRef} className="pose-canvas"/>{showPicker&&detections[selectionFrame]&&<DancerPicker frame={detections[selectionFrame]} width={videoRef.current?.videoWidth||1} height={videoRef.current?.videoHeight||1} mirror={videoMirror} selected={anchors.find(a=>a.frame===selectionFrame)?.person} onSelect={selectDancer}/>}{!url&&<div className="stage-empty"><span className="empty-orbit"><UploadCloud size={30}/></span><strong>Әуелі би видеосын жүкте</strong><small>MP4 немесе WebM · 200 МБ дейін</small><button className="small-cta" onClick={()=>fileInputRef.current?.click()}>Видео таңдау <ArrowRight size={15}/></button></div>}{phase==='analyzing'&&<div className="stage-progress"><div className="loading-ring"/><b>Қимылдар талдануда</b><small>{progress}%</small></div>}</div>
          <div className="media-controls"><button disabled={!url||showPicker||phase==='analyzing'} onClick={()=>{const v=videoRef.current;if(!v)return;if(phase==='practicing'){pause();return}if(phase==='paused'){void resume();return}if(v.paused)v.play().catch(()=>setError('Видео ойнатылмады.'));else v.pause()}} aria-label={playing?'Кідірту':'Ойнату'}>{playing?<Pause size={17} fill="currentColor"/>:<Play size={17} fill="currentColor"/>}</button><span className="time">{fmt(playhead)}</span><input className="timeline" aria-label="Видео уақыты" type="range" min={0} max={duration||1} step="0.01" value={playhead} disabled={!url||showPicker||phase==='analyzing'} onChange={e=>{const t=Number(e.target.value);if(videoRef.current)videoRef.current.currentTime=t;setPlayhead(t);drawReference(t)}}/><span className="time">{fmt(duration)}</span><button disabled={!url} aria-label={muted?'Дыбысты қосу':'Дыбысты өшіру'} onClick={()=>setMuted(!muted)}>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button></div>
        </div>
        <div className="media-card"><div className="card-head"><div className="card-icon mint"><Camera size={18}/></div><div><h3>Сенің камераң</h3><p>Қимылыңды осы жерден бақылаймыз</p></div><span className={`live-tag ${cameraOn?'on':''}`}><span/> {cameraOn?'ҚОСУЛЫ':'ӨШІРУЛІ'}</span></div>
          <div className="stage camera-stage"><video ref={cameraRef} autoPlay muted playsInline style={{transform:cameraMirror?'scaleX(-1)':undefined}}/><canvas ref={cameraCanvasRef} className="pose-canvas"/>{!cameraOn&&<div className="stage-empty"><span className="empty-orbit mint-orbit"><Camera size={30}/></span><strong>Камераңды қос</strong><small>Толық денең кадрда көрінсін</small><button className="small-cta mint-cta" onClick={startCamera}>Камераны қосу <ArrowRight size={15}/></button></div>}{countdown>0&&<div className="countdown">{countdown}</div>}</div>
          <div className="camera-bottom"><span><span className={`camera-indicator ${cameraOn?'on':''}`}/>{cameraOn?'Камера дайын':'Камера қосылмаған'}</span>{cameraOn?<button onClick={()=>{if(phase==='practicing'||phase==='paused')finish();if(phase==='countdown'){sessionRef.current++;setCountdown(0);setPhase('ready')}stopCamera()}}>Камераны өшіру</button>:<span>Жарық жақсы болуы керек</span>}</div>
        </div>
      </div>
      {detections.length>0&&phase!=='analyzing'&&<section className="tracking-panel" aria-label="Бишіні бақылау">
        <div><h3>{showPicker?'Видеода үйренетін бишіңді белгіле':'Таңдалған бишіні бақылау'}</h3><p>{showPicker?'Нөмірленген жақтауды басыңыз. Адамдар бірін-бірі жаппайтын кадрды таңдаңыз.':'Жасыл сызық тек таңдалған бишіні көрсетеді. Күмәнді кадрлар бағаланбайды.'}</p></div>
        <div className="tracking-stats"><span>{anchors.length} белгі</span><span>{Math.round(validSamples/detections.length*100)}% жарамды кадр</span></div>
        {showPicker?<><label className="frame-select">Таңдау кадры · {fmt(detections[selectionFrame].time)} · {detections[selectionFrame].people.length} биші<input aria-label="Бишіні таңдау кадры" type="range" min={0} max={detections.length-1} step={1} value={selectionFrame} onChange={e=>selectFrame(Number(e.target.value))}/></label><div className="dancer-buttons">{detections[selectionFrame].people.map((_,i)=><button className="secondary-button" key={i} onClick={()=>selectDancer(i)}>Биші {i+1}</button>)}</div>{!detections[selectionFrame].people.length&&<p>Бұл кадрда биші табылмады. Уақыт жолағын жылжытыңыз.</p>}</>:<button className="secondary-button" disabled={phase==='practicing'||phase==='countdown'} onClick={reopenPicker}>Бишіні осы кадрда қайта белгіле</button>}
        {anchors.length>0&&<div className="coverage-strip" aria-label="Бақылау сапасы">{samplesRef.current.map((sample,i)=><button key={i} title={`${fmt(sample.time)} · ${sample.pose&&!poseIssue(sample.pose)?'Жарамды':sample.trackReason||'Қайта белгілеу қажет'}`} className={sample.pose&&!poseIssue(sample.pose)?'valid':''} disabled={phase==='practicing'||phase==='countdown'} onClick={()=>{videoRef.current?.pause();setShowPicker(true);setPhase('selecting');selectFrame(i);videoRef.current?.scrollIntoView({behavior:'smooth',block:'center'})}} aria-label={`${sample.time.toFixed(2)} секунд: ${sample.pose&&!poseIssue(sample.pose)?'жарамды':'қайта белгілеу'}`}/>)}</div>}
        {anchors.length>0&&<button className="text-button" disabled={phase==='practicing'||phase==='countdown'} onClick={()=>{setAnchors([]);samplesRef.current=[];setValidSamples(0);setSourceReady(false);setSummary(null);reopenPicker()}}>Таңдауды тазалау</button>}
        <p className="tracking-note">6 адамға дейін ізделеді. Жоғалған бишіні жүйе өздігінен басқа адаммен алмастырмайды: келесі анық кадрда сол бишіні қайта белгілеңіз. Бірдей киім мен күрделі айқасу кезінде бақылау дәлдігі шектеулі.</p>
      </section>}
      <div className="below-grid">
        <section className="panel settings-panel"><div className="panel-head"><div><div className="section-kicker">01 / ДАЙЫНДЫҚ</div><h3>Сабақты баптау</h3></div><span className="panel-icon"><UploadCloud size={20}/></span></div>
          <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={e=>{loadFile(e.target.files?.[0]);e.target.value=''}}/>
          <button className="upload-row" onClick={()=>fileInputRef.current?.click()}><span className="upload-icon"><Video size={19}/></span><span><b>{fileName||'Видео файлын таңда'}</b><small>{fileName?'Басқа видео жүктеу үшін басыңыз':'Құрылғыңыздан MP4 немесе WebM жүктеңіз'}</small></span><UploadCloud size={18}/></button>
          <div className="field-heading"><label>Үйренетін үзінді</label><span>60 секундқа дейін</span></div>
          <div className="trim-inputs"><label>Басы <input type="number" min={0} max={Math.max(0,duration-.5)} step="0.1" value={Number(start.toFixed(1))} disabled={!url||phase==='analyzing'||phase==='practicing'} onChange={e=>{const next=moveStart({start,end},duration,Number(e.target.value));changeSegment(next.start,next.end)}}/> сек</label><label>Соңы <input type="number" min={.5} max={duration} step="0.1" value={Number(end.toFixed(1))} disabled={!url||phase==='analyzing'||phase==='practicing'} onChange={e=>{const next=moveEnd({start,end},duration,Number(e.target.value));changeSegment(next.start,next.end)}}/> сек</label></div>
          <div className="trim-track"><span style={{left:`${duration?start/duration*100:0}%`,width:`${duration?(end-start)/duration*100:0}%`}}/></div>
          <div className="settings-divider"/>
          <div className="options-row"><label>Ойнату жылдамдығы</label><div className="speed-pills">{[.25,.5,.75,1].map(n=><button key={n} className={speed===n?'selected':''} disabled={!url} onClick={()=>{setSpeed(n);if(videoRef.current)videoRef.current.playbackRate=n}}>{String(n).replace('.',',')}×</button>)}</div></div>
          <div className="toggle-row"><div><b>Үзіндіні қайталау</b><small>Таңдалған аралықты қайта ойнату</small></div><button className={`switch ${repeat?'on':''}`} onClick={()=>setRepeat(!repeat)} aria-label="Үзіндіні қайталау" aria-pressed={repeat}><span/></button></div>
          <div className="toggle-row"><div><b>Видеоның айна режимі</b><small>{videoMirror?'Қосулы · видео айнаша көрсетіледі':'Өшірулі · видео бастапқы күйінде'}</small></div><button className={`switch ${videoMirror?'on':''}`} onClick={()=>setVideoMirror(v=>!v)} aria-label="Видеоның айна режимі" aria-pressed={videoMirror}><span/></button></div>
          <div className="toggle-row"><div><b>Камераның айна режимі</b><small>{cameraMirror?'Қосулы · өзіңді айнадағыдай көресің':'Өшірулі · камера бастапқы күйінде'}</small></div><button className={`switch ${cameraMirror?'on':''}`} onClick={()=>setCameraMirror(v=>!v)} aria-label="Камераның айна режимі" aria-pressed={cameraMirror}><span/></button></div>
          <p className="privacy-note">Экрандағы қимылды қайтала. Салыстыру екі бейненің айна баптауларын ескереді.</p>
          <button className="primary-button" disabled={!readyToAnalyze} onClick={analyze}>{phase==='analyzing'?`Талданып жатыр · ${progress}%`:<><Sparkles size={18}/> Видеоны талдау <ArrowRight size={18}/></>}</button>
          <p className="privacy-note"><ShieldCheck size={15}/> Видео құрылғыңызда өңделеді және серверге жіберілмейді.</p>
        </section>
        <section className="panel practice-panel"><div className="panel-head"><div><div className="section-kicker">02 / ЖАТТЫҒУ</div><h3>Қимылыңды қайтала</h3></div><span className="panel-icon mint-icon"><Activity size={20}/></span></div>
          <div className="practice-state"><div className={`practice-symbol ${phase==='practicing'?'pulsing':''}`}><Activity size={29}/></div><div><b>{phase==='practicing'?'Қимыл талданып жатыр':phase==='countdown'?'Дайындал!':phase==='paused'?'Жаттығу кідірді':canPractice?'Бастауға дайынсың':'Қимылды бірге үйренейік'}</b><p>{phase==='practicing'?(cameraIssue||referenceNotice||'Үлгіге қарап, қимылды қайтала.'):'Видео талданып, камера қосылған соң жаттығуды баста.'}</p></div></div>
          <div className="scores"><div><span>Қимыл ұқсастығы</span><b>{live?`${live.poseScore}%`:'—'}</b><div className="score-bar"><span style={{width:`${live?.poseScore||0}%`}}/></div></div><div><span>Уақыт сәйкестігі</span><b>{live?`${live.timingScore}%`:'—'}</b><div className="score-bar mint-bar"><span style={{width:`${live?.timingScore||0}%`}}/></div></div></div>
          <div className="feedback"><span className="feedback-icon"><Sparkles size={16}/></span><div><b>Нақты кеңес</b><p>{live?.cue||(phase==='practicing'?(referenceNotice||cameraIssue||'Бағалау үшін дерек жеткіліксіз'):'Жаттығу кезінде түзету осы жерде көрінеді.')}</p></div></div>
          <div className="offset-row"><label htmlFor="offset">Уақытты ығыстыру <span title="Камера мен үлгі арасындағы кідірісті қолмен түзетеді"><Info size={14}/></span></label><div><input id="offset" type="range" min="-1" max="1" step="0.05" value={offset} onChange={e=>setOffset(Number(e.target.value))}/><span>{offset>0?'+':''}{offset.toFixed(2)} с</span></div></div>
          <div className="practice-actions">{phase==='practicing'?<><button className="primary-button" onClick={pause}><Pause size={17}/> Кідірту</button><button className="secondary-button" onClick={finish}>Аяқтау</button></>:phase==='paused'?<><button className="primary-button" onClick={resume}><Play size={17} fill="currentColor"/> Жалғастыру</button><button className="secondary-button" onClick={finish}>Аяқтау</button></>:<button className="primary-button" disabled={!canPractice||!cameraOn||phase==='countdown'} onClick={begin}><Play size={17} fill="currentColor"/> Жаттығуды бастау <ArrowRight size={18}/></button>}</div>
          <p className="practice-hint"><Timer size={15}/> Басталар алдында 3 секундтық кері санақ жүреді.</p>
        </section>
      </div>
      {summary&&<section className="result-panel"><div className="result-header"><div><div className="section-kicker">03 / ҚОРЫТЫНДЫ</div><h2>Бүгінгі нәтижең</h2><p>Әр қайталау сені алға жетелейді.</p></div><div className="result-medal"><b>{summary.score}%</b><span>ҚИМЫЛ</span></div></div><div className="result-stats"><div><small>Қимыл ұқсастығы</small><b>{summary.score}%</b></div><div><small>Уақыт сәйкестігі</small><b>{summary.timing}%</b></div><div><small>Жарамды кадр</small><b>{Math.round(summary.valid/summary.total*100)}%</b></div></div><div className="result-detail"><div><h4>Дене бөліктері</h4>{Object.entries(summary.parts).map(([part,value])=><div className="part-row" key={part}><span>{part}</span><div><span style={{width:`${value}%`}}/></div><b>{value}%</b></div>)}</div><div><h4>Қайталауға тұрарлық үзінділер</h4>{summary.difficult.length?summary.difficult.map(x=><div className="difficult-row" key={x.time}><span>{fmt(x.time)}–{fmt(x.time+3)}</span><b>{x.score}%</b></div>):<p>Қиын үзінді анықталмады.</p>}<p className="recommendation">{summary.recommendation}</p></div></div><div className="result-footer"><small>Пайыз бақыланған буын бұрыштары мен дене нүктелерінің үлгіге ұқсастығын көрсетеді. Уақыт бағасы ең ұқсас қимылдың қаншалықты кеш не ерте жасалғанына негізделеді. Бұл кәсіби биші бағасы емес.</small><button className="secondary-button" onClick={retryDifficult}><RotateCcw size={16}/> Қиын үзіндіні қайталау</button></div></section>}
      <footer><span>do the <b>dance</b>.</span><p>Би қимылын үйренуге арналған жеке студия. Топтық видеодан бір бишіні таңдап үйрен. Камерада бір адам толық көрінсін.</p><span>© 2026</span></footer>
    </main><main className="container history-page" hidden={tab!=='history'}><div className="history-title"><div><div className="section-kicker">СЕНІҢ ӨСУ ЖОЛЫҢ</div><h1>Нәтижелер тарихы</h1><p>Өткен жаттығуларыңның көрсеткіштері тек осы браузерде сақталады.</p></div><button className="secondary-button" onClick={()=>setTab('studio')}><ArrowRight size={17}/> Студияға оралу</button></div>{history.length?<><div className="history-list">{history.map(item=><div className="history-item" key={item.id}><span className="history-icon"><History size={22}/></span><div><b>{item.name}</b><small>{new Date(item.date).toLocaleDateString('kk-KZ',{year:'numeric',month:'long',day:'numeric'})} · {item.valid}/{item.total} жарамды кадр</small></div><div className="history-scores"><span>Қимыл <b>{item.score}%</b></span><span>Уақыт <b>{item.timing}%</b></span></div></div>)}</div><button className="delete-history" onClick={()=>{clearHistory();setHistory([])}}><Trash2 size={17}/> Тарихты өшіру</button></>:<div className="empty-history"><span><History size={28}/></span><h2>Әзірге нәтиже жоқ</h2><p>Алғашқы жаттығуыңды аяқтағанда нәтижең осында сақталады.</p><button className="primary-button" onClick={()=>setTab('studio')}>Жаттығуды бастау <ArrowRight size={17}/></button></div>}<footer><span>do the <b>dance</b>.</span><p>Прогресс көрсеткіштері осы құрылғыда сақталады.</p><span>© 2026</span></footer></main>
  </div>
}
