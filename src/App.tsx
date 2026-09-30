import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BRAND, HOOD_COLORS, type HoodColor } from './lib/colors'
import {
  composePfp,
  DEFAULT_TRANSFORM,
  downloadCanvas,
  sharePfp,
  SIZE,
  type ShareTarget,
  type Transform,
} from './lib/compose'
import { buildEyesSvg, buildHoodImage, svgToImage } from './lib/hoodSvg'
import './App.css'

function clampScale(n: number) {
  return Math.min(3, Math.max(0.5, n))
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

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
  const stageRef = useRef<HTMLDivElement>(null)

  const transformRef = useRef(transform)
  const photoRef = useRef(photo)
  const hoodRef = useRef(hoodImg)
  const eyesRef = useRef(eyesImg)
  const voidRef = useRef(voidFace)
  const rafRef = useRef(0)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    mode: 'drag' | 'pinch'
    startX: number
    startY: number
    originX: number
    originY: number
    startScale: number
    startDist: number
  } | null>(null)

  useEffect(() => {
    transformRef.current = transform
  }, [transform])
  useEffect(() => {
    photoRef.current = photo
  }, [photo])
  useEffect(() => {
    hoodRef.current = hoodImg
  }, [hoodImg])
  useEffect(() => {
    eyesRef.current = eyesImg
  }, [eyesImg])
  useEffect(() => {
    voidRef.current = voidFace
  }, [voidFace])

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

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const hood = hoodRef.current
    if (!canvas || !hood) return

    const photoImg = photoRef.current
    const voidMode = voidRef.current

    if (!photoImg && !voidMode) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (canvas.width !== SIZE || canvas.height !== SIZE) {
        canvas.width = SIZE
        canvas.height = SIZE
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(hood, 0, 0, SIZE, SIZE)
      ctx.fillStyle = 'rgba(244,244,240,0.55)'
      ctx.font = `600 ${Math.round(SIZE * 0.035)}px Manrope, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Drop your PFP here', SIZE / 2, SIZE * 0.39)
      return
    }

    composePfp({
      photo: photoImg ?? hood,
      hood,
      eyes: eyesRef.current,
      transform: transformRef.current,
      voidFace: voidMode || !photoImg,
      target: canvas,
    })
  }, [])

  const schedulePaint = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(paint)
  }, [paint])

  useEffect(() => {
    schedulePaint()
  }, [photo, hoodImg, eyesImg, transform, voidFace, schedulePaint])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i)) {
      setError('Upload an image file (PNG, JPG, WEBP).')
      return
    }
    setError('')

    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.decoding = 'async'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not read that image.'))
        img.src = url
      })
      try {
        await img.decode()
      } catch {
        /* decode optional */
      }
      URL.revokeObjectURL(url)
      setPhoto(img)
      setPhotoName(file.name)
      setTransform(DEFAULT_TRANSFORM)
      transformRef.current = DEFAULT_TRANSFORM
      setVoidFace(false)
      setShareNote('')
    } catch {
      setError('Could not read that image.')
    }
  }

  const commitTransform = (next: Transform) => {
    transformRef.current = next
    setTransform(next)
    schedulePaint()
  }

  // Native listeners so we can preventDefault (stop page zoom / scroll) on mobile.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    const onPointerDown = (e: PointerEvent) => {
      if (!photoRef.current || voidRef.current) return
      el.setPointerCapture(e.pointerId)
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.current.size === 1) {
        setDragging(true)
        gesture.current = {
          mode: 'drag',
          startX: e.clientX,
          startY: e.clientY,
          originX: transformRef.current.x,
          originY: transformRef.current.y,
          startScale: transformRef.current.scale,
          startDist: 0,
        }
      } else if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()]
        gesture.current = {
          mode: 'pinch',
          startX: (pts[0].x + pts[1].x) / 2,
          startY: (pts[0].y + pts[1].y) / 2,
          originX: transformRef.current.x,
          originY: transformRef.current.y,
          startScale: transformRef.current.scale,
          startDist: dist(pts[0], pts[1]),
        }
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!gesture.current || !photoRef.current || voidRef.current) return
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      const g = gesture.current
      const rect = el.getBoundingClientRect()
      const toCanvas = SIZE / rect.width

      if (g.mode === 'drag' && pointers.current.size === 1) {
        const dx = (e.clientX - g.startX) * toCanvas
        const dy = (e.clientY - g.startY) * toCanvas
        commitTransform({
          ...transformRef.current,
          x: g.originX + dx,
          y: g.originY + dy,
        })
      } else if (pointers.current.size >= 2) {
        const pts = [...pointers.current.values()]
        const dNow = dist(pts[0], pts[1])
        if (!g.startDist) {
          g.mode = 'pinch'
          g.startDist = dNow
          g.startScale = transformRef.current.scale
          g.originX = transformRef.current.x
          g.originY = transformRef.current.y
        }
        const ratio = dNow / (g.startDist || dNow)
        commitTransform({
          ...transformRef.current,
          scale: clampScale(g.startScale * ratio),
        })
      }
    }

    const endPointer = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size === 0) {
        gesture.current = null
        setDragging(false)
      } else if (pointers.current.size === 1) {
        const pt = [...pointers.current.values()][0]
        gesture.current = {
          mode: 'drag',
          startX: pt.x,
          startY: pt.y,
          originX: transformRef.current.x,
          originY: transformRef.current.y,
          startScale: transformRef.current.scale,
          startDist: 0,
        }
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (!photoRef.current || voidRef.current) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.05 : 0.05
      commitTransform({
        ...transformRef.current,
        scale: clampScale(transformRef.current.scale + delta),
      })
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPointer)
    el.addEventListener('pointercancel', endPointer)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endPointer)
      el.removeEventListener('pointercancel', endPointer)
      el.removeEventListener('wheel', onWheel)
    }
  }, [schedulePaint])

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
      transform: transformRef.current,
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
      await sharePfp(canvas, target)
      setShareNote(
        target === 'x'
          ? 'PNG downloaded — attach it to your X post.'
          : 'PNG downloaded — attach it in Telegram.',
      )
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
    return 'Drag with one finger · pinch to zoom · or use the sliders.'
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
                  min={0.5}
                  max={3}
                  step={0.01}
                  value={transform.scale}
                  disabled={!canEditPhoto}
                  onChange={(e) =>
                    commitTransform({ ...transformRef.current, scale: Number(e.target.value) })
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
                    commitTransform({
                      ...transformRef.current,
                      rotation: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className="row">
              <button
                className="btn ghost"
                type="button"
                disabled={!photo}
                onClick={() => commitTransform(DEFAULT_TRANSFORM)}
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
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onFile(e.dataTransfer.files?.[0])
            }}
          >
            <canvas ref={canvasRef} width={SIZE} height={SIZE} aria-label="Hooded PFP preview" />
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
