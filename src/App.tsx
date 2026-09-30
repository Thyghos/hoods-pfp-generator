import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BRAND, HOOD_COLORS, type HoodColor } from './lib/colors'
import {
  composePfp,
  DEFAULT_TRANSFORM,
  downloadCanvas,
  sharePfp,
  type ShareTarget,
  type Transform,
} from './lib/compose'
import { buildEyesSvg, buildHoodImage, svgToImage } from './lib/hoodSvg'
import './App.css'

export default function App() {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [photoName, setPhotoName] = useState('')
  const [color, setColor] = useState<HoodColor>(HOOD_COLORS[0])
  const [feather, setFeather] = useState(true)
  const [voidFace, setVoidFace] = useState(false)
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM)
  const [hoodImg, setHoodImg] = useState<HTMLImageElement | null>(null)
  const [eyesImg, setEyesImg] = useState<HTMLImageElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    buildHoodImage(color, { feather }).then((img) => {
      if (!cancelled) setHoodImg(img)
    })
    return () => {
      cancelled = true
    }
  }, [color, feather])

  useEffect(() => {
    svgToImage(buildEyesSvg()).then(setEyesImg)
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hoodImg) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!photo && !voidFace) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(hoodImg, 0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(244,244,240,0.55)'
      ctx.font = '600 36px Manrope, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Drop your PFP here', canvas.width / 2, 400)
      return
    }

    const composed = composePfp({
      photo: photo ?? hoodImg,
      hood: hoodImg,
      eyes: eyesImg,
      transform,
      voidFace: voidFace || !photo,
    })
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(composed, 0, 0)
  }, [photo, hoodImg, eyesImg, transform, voidFace])

  useEffect(() => {
    redraw()
  }, [redraw])

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Upload an image file (PNG, JPG, WEBP).')
      return
    }
    setError('')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setPhoto(img)
      setPhotoName(file.name)
      setTransform(DEFAULT_TRANSFORM)
      setVoidFace(false)
      setShareNote('')
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      setError('Could not read that image.')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!photo || voidFace) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const scale = 1024 / rect.width
    const dx = (e.clientX - dragStart.current.x) * scale
    const dy = (e.clientY - dragStart.current.y) * scale
    setTransform((t) => ({
      ...t,
      x: dragStart.current!.tx + dx,
      y: dragStart.current!.ty + dy,
    }))
  }

  const onPointerUp = () => {
    setDragging(false)
    dragStart.current = null
  }

  const onWheel = (e: React.WheelEvent) => {
    if (!photo || voidFace) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.04 : 0.04
    setTransform((t) => ({
      ...t,
      scale: Math.min(3, Math.max(0.4, t.scale + delta)),
    }))
  }

  const buildCanvas = () => {
    if (!hoodImg || (!photo && !voidFace)) {
      setError('Upload a profile picture first.')
      return null
    }
    setError('')
    return composePfp({
      photo: photo ?? hoodImg,
      hood: hoodImg,
      eyes: eyesImg,
      transform,
      voidFace: voidFace || !photo,
    })
  }

  const download = () => {
    const canvas = buildCanvas()
    if (!canvas) return
    downloadCanvas(canvas, `hoods-${color.id}-pfp.png`)
  }

  const share = async (target: ShareTarget) => {
    const canvas = buildCanvas()
    if (!canvas) return
    setSharing(true)
    setShareNote('')
    try {
      const result = await sharePfp(canvas, target)
      if (result === 'intent') {
        setShareNote('PNG downloaded — attach it in the compose window.')
      }
    } catch {
      setError('Share failed. Try Download PNG instead.')
    } finally {
      setSharing(false)
    }
  }

  const canEditPhoto = Boolean(photo) && !voidFace
  const canExport = Boolean(photo) || voidFace

  const hint = useMemo(() => {
    if (!photo) return 'Upload a Telegram, Discord, or X profile picture.'
    if (voidFace) return 'Mascot mode — black void + glowing eyes.'
    return 'Drag to position your face in the hood · scroll to scale.'
  }, [photo, voidFace])

  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="https://www.rhoods.xyz/" target="_blank" rel="noreferrer">
          HOODS
        </a>
        <div className="top-actions">
          <a className="btn ghost" href="https://www.rhoods.xyz/" target="_blank" rel="noreferrer">
            Site
          </a>
          <a
            className="btn solid"
            href="https://www.rhoods.xyz/"
            target="_blank"
            rel="noreferrer"
          >
            Buy $HOODS ↗
          </a>
        </div>
      </header>

      <main className="main">
        <section className="copy">
          <p className="eyebrow">Robinhood Chain · PFP studio</p>
          <h1>Add a hood.</h1>
          <p className="lede">
            Drop your Telegram, Discord, or X picture. Put on the green hood. Join the set.
          </p>

          <div className="controls">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button className="btn solid wide" type="button" onClick={() => fileRef.current?.click()}>
              {photo ? 'Change photo' : 'Upload PFP'}
            </button>
            {photoName ? <p className="file-name">{photoName}</p> : null}

            <div className="field">
              <span className="label">Hood color</span>
              <div className="swatches" role="listbox" aria-label="Hood color">
                {HOOD_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={color.id === c.id}
                    className={`swatch ${color.id === c.id ? 'active' : ''}`}
                    style={{ background: c.fabric }}
                    title={c.label}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <span className="swatch-label">{color.label}</span>
            </div>

            <label className="toggle">
              <input
                type="checkbox"
                checked={feather}
                onChange={(e) => setFeather(e.target.checked)}
              />
              <span>Red feather</span>
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={voidFace}
                disabled={!photo && !voidFace}
                onChange={(e) => setVoidFace(e.target.checked)}
              />
              <span>Mascot face (void + eyes)</span>
            </label>

            <div className={`sliders ${canEditPhoto ? '' : 'disabled'}`}>
              <label>
                <span>Zoom</span>
                <input
                  type="range"
                  min={0.6}
                  max={2.8}
                  step={0.01}
                  value={transform.scale}
                  disabled={!canEditPhoto}
                  onChange={(e) =>
                    setTransform((t) => ({ ...t, scale: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                <span>Rotate</span>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={transform.rotation}
                  disabled={!canEditPhoto}
                  onChange={(e) =>
                    setTransform((t) => ({ ...t, rotation: Number(e.target.value) }))
                  }
                />
              </label>
            </div>

            <div className="row">
              <button
                className="btn ghost"
                type="button"
                disabled={!photo}
                onClick={() => setTransform(DEFAULT_TRANSFORM)}
              >
                Reset
              </button>
              <button className="btn solid" type="button" onClick={download} disabled={!canExport}>
                Download PNG
              </button>
            </div>

            <div className="row">
              <button
                className="btn ghost"
                type="button"
                disabled={!canExport || sharing}
                onClick={() => share('x')}
              >
                Share to X
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={!canExport || sharing}
                onClick={() => share('telegram')}
              >
                Share to Telegram
              </button>
            </div>

            {shareNote ? <p className="note">{shareNote}</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </div>
        </section>

        <section className="stage-wrap">
          <div
            ref={stageRef}
            className={`stage ${dragging ? 'dragging' : ''} ${photo && !voidFace ? 'editable' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onFile(e.dataTransfer.files?.[0])
            }}
          >
            <canvas ref={canvasRef} width={1024} height={1024} aria-label="Hooded PFP preview" />
          </div>
          <p className="hint">{hint}</p>
        </section>
      </main>

      <footer className="foot">
        <span>Same hoodie. Different you.</span>
        <span style={{ color: BRAND.muted }}>Not affiliated with Robinhood Markets.</span>
      </footer>
    </div>
  )
}
