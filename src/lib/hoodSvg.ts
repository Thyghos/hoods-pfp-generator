import type { HoodColor } from './colors'

/** Face opening in the 3D overlay, authored at 1024 coords (scaled at compose time). */
export const FACE = {
  cx: 512,
  cy: 402,
  rx: 200,
  ry: 188,
} as const

const OVERLAY_URL = '/overlays/hood-3d.png?v=3'
const HOOD_SIZE = 1536

let baseHoodPromise: Promise<HTMLImageElement> | null = null

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })
}

function getBaseHood(): Promise<HTMLImageElement> {
  if (!baseHoodPromise) baseHoodPromise = loadImage(OVERLAY_URL)
  return baseHoodPromise
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/**
 * Builds a colored 3D hood overlay from the brand PNG.
 * Recolors green fabric toward `color`, optionally strips the red feather.
 */
export async function buildHoodImage(
  color: HoodColor,
  options?: { feather?: boolean },
): Promise<HTMLImageElement> {
  const base = await getBaseHood()
  const feather = options?.feather !== false
  const canvas = document.createElement('canvas')
  canvas.width = HOOD_SIZE
  canvas.height = HOOD_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas unsupported')

  ctx.clearRect(0, 0, HOOD_SIZE, HOOD_SIZE)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(base, 0, 0, HOOD_SIZE, HOOD_SIZE)

  const imageData = ctx.getImageData(0, 0, HOOD_SIZE, HOOD_SIZE)
  const d = imageData.data
  const [tr, tg, tb] = hexToRgb(color.fabric)
  const isLime = color.id === 'lime'

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (a < 8) {
      d[i] = 0
      d[i + 1] = 0
      d[i + 2] = 0
      d[i + 3] = 0
      continue
    }
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]

    const isFeather = r > g + 15 && r > b + 10 && r > 70
    if (isFeather) {
      if (!feather) {
        d[i] = 0
        d[i + 1] = 0
        d[i + 2] = 0
        d[i + 3] = 0
      }
      continue
    }

    const isGreen = g > r + 6 && g > b + 6 && g > 35
    if (!isGreen || isLime) continue

    const shade = Math.min(1.4, Math.max(0.25, g / 160))
    d[i] = Math.min(255, Math.round(tr * shade))
    d[i + 1] = Math.min(255, Math.round(tg * shade))
    d[i + 2] = Math.min(255, Math.round(tb * shade))
  }

  ctx.putImageData(imageData, 0, 0)

  return canvasToImage(canvas)
}

export function buildEyesSvg(): string {
  const { cx, cy, rx, ry } = FACE
  const s = HOOD_SIZE / 1024
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HOOD_SIZE} ${HOOD_SIZE}" width="${HOOD_SIZE}" height="${HOOD_SIZE}">
  <ellipse cx="${cx * s}" cy="${cy * s}" rx="${rx * s}" ry="${ry * s}" fill="#050505"/>
  <ellipse cx="${(cx - 52) * s}" cy="${(cy - 6) * s}" rx="${24 * s}" ry="${42 * s}" fill="#f4f4f0"/>
  <ellipse cx="${(cx + 52) * s}" cy="${(cy - 6) * s}" rx="${24 * s}" ry="${42 * s}" fill="#f4f4f0"/>
</svg>`
}

export function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG'))
    }
    img.src = url
  })
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode hood'))
        return
      }
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to encode hood'))
      }
      img.src = url
    }, 'image/png')
  })
}
