import { FACE } from './hoodSvg'

const SIZE = 1024

export type Transform = {
  x: number
  y: number
  scale: number
  rotation: number
}

export type ComposeOptions = {
  photo: HTMLImageElement
  hood: HTMLImageElement
  eyes?: HTMLImageElement | null
  /** Moves / scales the uploaded photo inside the face opening */
  transform: Transform
  voidFace?: boolean
}

/** Default: zoom photo so a typical head fills the hood opening. */
export const DEFAULT_TRANSFORM: Transform = { x: 0, y: -40, scale: 1.15, rotation: 0 }

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number,
  t: Transform,
) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const base = Math.max(size / iw, size / ih)
  const scale = base * t.scale
  const w = iw * scale
  const h = ih * scale

  ctx.save()
  ctx.translate(size / 2 + t.x, size / 2 + t.y)
  ctx.rotate((t.rotation * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
}

/**
 * Brand-style compose:
 * 1) black canvas
 * 2) photo clipped to the face oval (so ears/shoulders don't stick out around the hood)
 * 3) hood overlay with transparent opening
 */
export function composePfp(options: ComposeOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')

  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, SIZE, SIZE)

  if (options.voidFace) {
    if (options.eyes) {
      ctx.drawImage(options.eyes, 0, 0, SIZE, SIZE)
    }
  } else {
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(FACE.cx, FACE.cy, FACE.rx, FACE.ry, 0, 0, Math.PI * 2)
    ctx.clip()
    coverDraw(ctx, options.photo, SIZE, options.transform)
    ctx.restore()
  }

  ctx.drawImage(options.hood, 0, 0, SIZE, SIZE)

  return canvas
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename = 'hoods-pfp.png') {
  const a = document.createElement('a')
  a.download = filename
  a.href = canvas.toDataURL('image/png')
  a.click()
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not export PNG'))
    }, 'image/png')
  })
}

export async function canvasToFile(
  canvas: HTMLCanvasElement,
  filename = 'hoods-pfp.png',
): Promise<File> {
  const blob = await canvasToBlob(canvas)
  return new File([blob], filename, { type: 'image/png' })
}

export const SHARE_SITE = 'https://www.rhoods.xyz/'
export const SHARE_TEXT = 'I hooded up. $HOODS'

export function xIntentUrl(text = SHARE_TEXT, url = SHARE_SITE) {
  const params = new URLSearchParams({ text: `${text}\n${url}` })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function telegramShareUrl(text = SHARE_TEXT, url = SHARE_SITE) {
  const params = new URLSearchParams({ url, text })
  return `https://t.me/share/url?${params.toString()}`
}

export type ShareTarget = 'x' | 'telegram'
export type ShareResult = 'native' | 'intent'

export async function sharePfp(
  canvas: HTMLCanvasElement,
  target: ShareTarget,
): Promise<ShareResult> {
  const filename = 'hoods-pfp.png'
  const file = await canvasToFile(canvas, filename)
  const text = SHARE_TEXT
  const url = SHARE_SITE

  const canFileShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canFileShare) {
    try {
      await navigator.share({
        files: [file],
        text: `${text} ${url}`,
        title: 'HOODS PFP',
      })
      return 'native'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'native'
    }
  }

  downloadCanvas(canvas, filename)

  const intent = target === 'x' ? xIntentUrl(text, url) : telegramShareUrl(text, url)
  window.open(intent, '_blank', 'noopener,noreferrer')
  return 'intent'
}

export const CANVAS_SIZE = SIZE
