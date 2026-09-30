import { FACE } from './hoodSvg'

export const SIZE = 1536

export type Transform = {
  x: number
  y: number
  scale: number
  rotation: number
}

export type ComposeOptions = {
  photo: HTMLImageElement | ImageBitmap
  hood: HTMLImageElement
  eyes?: HTMLImageElement | null
  transform: Transform
  voidFace?: boolean
  /** Draw into an existing canvas when provided (avoids alloc thrash on mobile). */
  target?: HTMLCanvasElement
}

/** Default: zoom photo so a typical head fills the hood opening. */
export const DEFAULT_TRANSFORM: Transform = { x: 0, y: -60, scale: 1.15, rotation: 0 }

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | ImageBitmap,
  size: number,
  t: Transform,
) {
  const iw = 'naturalWidth' in img ? img.naturalWidth || img.width : img.width
  const ih = 'naturalHeight' in img ? img.naturalHeight || img.height : img.height
  if (!iw || !ih) return

  const base = Math.max(size / iw, size / ih)
  const scale = base * t.scale
  const w = iw * scale
  const h = ih * scale

  ctx.save()
  ctx.translate(size / 2 + t.x, size / 2 + t.y)
  ctx.rotate((t.rotation * Math.PI) / 180)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
}

/**
 * Brand-style compose into `target` or a fresh canvas.
 * Face is clipped to the hood opening; hood drawn on top with smoothed edges.
 */
export function composePfp(options: ComposeOptions): HTMLCanvasElement {
  const canvas = options.target ?? document.createElement('canvas')
  if (canvas.width !== SIZE || canvas.height !== SIZE) {
    canvas.width = SIZE
    canvas.height = SIZE
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')

  const scale = SIZE / 1024
  const cx = FACE.cx * scale
  const cy = FACE.cy * scale
  const rx = FACE.rx * scale
  const ry = FACE.ry * scale

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (options.voidFace) {
    if (options.eyes) {
      ctx.drawImage(options.eyes, 0, 0, SIZE, SIZE)
    }
  } else {
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
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

/** Downloads the PNG, then opens X compose or Telegram share with prefilled text. */
export async function sharePfp(canvas: HTMLCanvasElement, target: ShareTarget) {
  const filename = 'hoods-pfp.png'
  downloadCanvas(canvas, filename)

  const intent = target === 'x' ? xIntentUrl() : telegramShareUrl()
  window.open(intent, '_blank', 'noopener,noreferrer')
}

export const CANVAS_SIZE = SIZE
