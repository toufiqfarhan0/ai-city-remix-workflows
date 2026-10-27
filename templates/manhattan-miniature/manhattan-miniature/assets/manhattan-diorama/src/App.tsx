import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { attachCity, runtime, signalError, signalReady } from './capture'
import { createCity, landmarks, type CityAPI } from './city'
import { isLikelyMobile, landmarkKey, LANDMARK_IDS, type QualityTier } from './config'
import { params, reducedMotion, restricted, t, view, type Strings } from './params'
import { CONFIG } from './skill-config'
import { BrandMark } from './ui/BrandMark'
import { ArrowUpRight, Camera, Compass, MapPin, Maximize, Minus, MousePointer2, Moon, MoveUpRight, Plus, RotateCcw, RotateCw, Sun, X } from './ui/icons'

type Layout = 'full' | 'compact'
const layoutOf = (): Layout => (window.innerWidth < 900 || window.innerHeight < 560 ? 'compact' : 'full')
const text = (key: string) => t[key as keyof Strings]
const lm = (i: number, part: 'Name' | 'Area' | 'Text' | 'Short') => text(`${landmarkKey(LANDMARK_IDS[i])}${part}`)

document.documentElement.style.setProperty('--accent', CONFIG.accent)

export default function App() {
  const host = useRef<HTMLDivElement>(null),
    api = useRef<CityAPI | null>(null)
  const [night, setNightState] = useState(false),
    [rotate, setRotateState] = useState(false),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [toast, setToast] = useState(''),
    [error, setError] = useState(''),
    [capture, setCapture] = useState<string | null>(null),
    [layout, setLayout] = useState<Layout>(layoutOf)
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // Every control goes through these functions, so the buttons, the card and the camera change in
  // the same call (window.__scene.act wraps them in flushSync).
  function setNight(v: boolean) {
    setNightState(v)
    api.current?.setNight(v)
  }
  function setRotate(v: boolean) {
    setRotateState(v)
    api.current?.setRotate(v)
  }
  function selectLandmark(i: number) {
    setSelected(i)
    runtime.selected = LANDMARK_IDS[i]
    setRotate(false)
    api.current?.focus(i)
  }
  function closeLandmark() {
    setSelected(null)
    runtime.selected = null
  }
  function reset() {
    closeLandmark()
    setRotate(false)
    api.current?.reset()
  }
  function zoom(factor: number) {
    api.current?.zoom(factor)
  }
  runtime.handlers = { selectLandmark, closeLandmark, setNight, setRotate, reset, zoom }

  useLayoutEffect(() => {
    const update = () => {
      const l = layoutOf()
      document.body.dataset.layout = l
      runtime.layout = l
      setLayout(l)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!host.current) return
    const quality: QualityTier = params.quality ?? (isLikelyMobile() ? 'low' : 'high')
    runtime.quality = quality
    try {
      const city = createCity(host.current, {
        quality,
        reducedMotion,
        live: !params.capture,
        view,
        viewOffset: () => layoutRef.current === 'full' && !params.embed,
        onFrame: () => {
          setReady(true)
          signalReady()
        },
      })
      api.current = city
      attachCity(city)
    } catch (e) {
      setError(t.webglMissing)
      console.error(e)
      signalError()
    }
    return () => {
      api.current?.dispose()
      api.current = null
      runtime.city = null
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(id)
  }, [toast])

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      setToast(t.fullscreenUnavailable)
    }
  }

  const compact = layout === 'compact'
  const hint = <p className="hint">{!compact && <MousePointer2 size={13} />}<span>{touch ? t.hintTouch : t.hint}</span></p>
  const brandInner = (
    <>
      {CONFIG.use_sandbase_mark && <BrandMark />}
      <span className="brand-name">{CONFIG.brand_name}</span>
      <span className="brand-slash" aria-hidden="true">/</span>
      <span className="brand-lab">{CONFIG.brand_label}</span>
      <span className="brand-divider" />
      <span className="campaign">{t.campaign}</span>
    </>
  )

  return (
    <main className={night ? 'app night' : 'app'}>
      <div className="canvas" ref={host} aria-label={t.sceneAria} />
      {!ready && !error && (
        <div className="loading">
          <span />
          {t.loading}
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {!params.embed && (
        <header>
          {restricted ? (
            <span className="brand">{brandInner}</span>
          ) : (
            <a
              className="brand"
              href="#"
              onClick={(e) => {
                e.preventDefault()
                reset()
              }}
              aria-label={t.homeAria}
            >
              {brandInner}
            </a>
          )}
          {!restricted && (
            <a className="edition" href={CONFIG.brand_url} target="_blank" rel="noreferrer">
              {t.tagline}
              <ArrowUpRight size={14} />
            </a>
          )}
        </header>
      )}
      {!params.embed && !compact && (
        <section className="intro">
          <div className="eyebrow">
            <span /> {t.eyebrow}
          </div>
          <h1>
            {t.titleLine1}
            <br />
            <em>{t.titleLine2}</em>
          </h1>
          <p>
            {t.subtitle1}
            <br />
            {t.subtitle2}
          </p>
          <div className="intro-line" />
          <span className="explore-copy">{t.explore}</span>
        </section>
      )}
      {compact && hint}
      <section className="top-controls" aria-label={t.sceneControls}>
        <div className="mode-switch">
          <button className={!night ? 'active' : ''} aria-pressed={!night} data-act="day" onClick={() => setNight(false)}>
            <Sun size={16} />
            {t.day}
          </button>
          <button className={night ? 'active' : ''} aria-pressed={night} data-act="night" onClick={() => setNight(true)}>
            <Moon size={15} />
            {t.night}
          </button>
        </div>
        <button
          className={'square ' + (rotate ? 'selected' : '')}
          aria-label={t.autoRotate}
          aria-pressed={rotate}
          title={t.autoRotate}
          data-act="rotate"
          onClick={() => setRotate(!rotate)}
        >
          <RotateCw size={17} />
        </button>
        <button className="square" title={t.resetView} aria-label={t.resetView} data-act="reset" onClick={reset}>
          <RotateCcw size={17} />
        </button>
      </section>
      <div className="location">
        <span className="live-dot" />
        <span className="status">{night ? t.statusNight : t.statusDay}</span>
        <span className="coordinate">40.7831° N &nbsp; 73.9712° W</span>
      </div>
      <aside className="view-tools" aria-label={t.viewTools}>
        <button aria-label={t.zoomIn} title={t.zoomIn} data-act="zoom-in" onClick={() => zoom(0.8)}>
          <Plus size={18} />
        </button>
        <button aria-label={t.zoomOut} title={t.zoomOut} data-act="zoom-out" onClick={() => zoom(1.25)}>
          <Minus size={18} />
        </button>
        {!restricted && !compact && (
          <>
            <div />
            <button aria-label={t.screenshot} title={t.screenshot} data-act="screenshot" onClick={() => setCapture(api.current?.screenshot() ?? null)}>
              <Camera size={17} />
            </button>
            <button aria-label={t.fullscreen} title={t.fullscreen} data-act="fullscreen" onClick={fullscreen}>
              <Maximize size={17} />
            </button>
          </>
        )}
      </aside>
      {!compact && (
        <div className="compass">
          <Compass size={32} strokeWidth={1} />
          <span>N</span>
        </div>
      )}
      {selected !== null && (
        <div className="landmark-info">
          <button aria-label={t.closeLandmark} data-act="close" onClick={closeLandmark}>
            <X size={15} />
          </button>
          <span className="eyebrow">{lm(selected, 'Area')}</span>
          <h2>{lm(selected, 'Name')}</h2>
          <p>{lm(selected, 'Text')}</p>
        </div>
      )}
      <section className="landmark-bar" aria-label={t.landmarksLabel}>
        <div className="landmark-label">
          <MapPin size={15} />
          <span>{t.landmarksLabel}</span>
        </div>
        <div className="landmark-buttons">
          {landmarks.map((l, i) => (
            <button
              className={selected === i ? 'chosen' : ''}
              key={l.id}
              data-landmark={l.id}
              aria-pressed={selected === i}
              aria-label={compact ? lm(i, 'Name') : undefined}
              onClick={() => selectLandmark(i)}
            >
              <span className="landmark-num">0{i + 1}</span>
              <span className="landmark-name">{compact ? lm(i, 'Short') : lm(i, 'Name')}</span>
              <MoveUpRight size={13} />
            </button>
          ))}
        </div>
      </section>
      {!compact && (
        <footer>
          {hint}
          {!params.embed && <span className="collectible">{t.collectible}</span>}
        </footer>
      )}
      {capture && (
        <div className="capture-backdrop" role="dialog" aria-modal="true" aria-label={t.snapshotTitle}>
          <div className="capture-panel">
            <button aria-label={t.closeSnapshot} onClick={() => setCapture(null)}>
              <X size={18} />
            </button>
            <img src={capture} alt={t.snapshotAlt} />
            <div>
              <span>{t.snapshotTitle}</span>
              <a href={capture} download={`manhattan-${night ? 'night' : 'day'}.png`}>
                {t.downloadPng} <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  )
}
