import { Check, ArrowRight } from 'lucide-react'

type Props = {
  loaded: boolean; analyzed: boolean; selected: boolean; cameraReady: boolean
  analyzing: boolean; cameraStarting: boolean; cameraOn: boolean
  onUpload: () => void; onAnalyze: () => void; onSelect: () => void; onCamera: () => void
}

export function SetupGuide(p: Props) {
  const steps = [
    { title: 'Видео таңда', detail: 'MP4 немесе WebM · 200 МБ дейін', done: p.loaded, action: p.onUpload, label: 'Видео таңдау' },
    { title: 'Үзіндіні талда', detail: 'Алғашқы рет 10–15 секундтан баста.', done: p.analyzed, action: p.onAnalyze, label: p.analyzing ? 'Талданып жатыр…' : 'Талдау', disabled: !p.loaded || p.analyzing },
    { title: 'Бишіні таңда', detail: 'Үлгідегі үйренетін адамыңды белгіле.', done: p.selected, action: p.onSelect, label: 'Бишіні таңдау', disabled: !p.analyzed },
    { title: 'Камераны тексер', detail: 'Бір адам. Бас, қол, аяқ толық көрінсін.', done: p.cameraReady, action: p.onCamera, label: p.cameraStarting ? 'Қосылуда…' : p.cameraOn ? 'Камераға қара' : 'Камераны қосу', disabled: p.cameraStarting },
  ]
  const current = steps.findIndex(s => !s.done)
  return <section className="setup-guide" aria-label="Жаттығуға дайындық">
    <div className="guide-heading"><b>Алғашқы қимылға 4 қадам</b><span>{steps.filter(s => s.done).length}/4 дайын</span></div>
    <ol>{steps.map((step, i) => <li key={step.title} className={step.done ? 'complete' : current === i ? 'current' : ''} aria-current={current === i ? 'step' : undefined}>
      <span className="step-number">{step.done ? <Check size={16}/> : `0${i + 1}`}</span>
      <div><b>{step.title}</b><p>{step.detail}</p>{!step.done && <button disabled={step.disabled} onClick={step.action}>{step.label}<ArrowRight size={14}/></button>}</div>
    </li>)}</ol>
  </section>
}
