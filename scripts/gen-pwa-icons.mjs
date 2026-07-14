// Generates PWA icons (192, 512, maskable-512, apple-touch 180) from build/icon.png.
// Run: node scripts/gen-pwa-icons.mjs
import { PNG } from 'pngjs'
import fs from 'fs'

const src = PNG.sync.read(fs.readFileSync('build/icon.png'))
const px = (img, x, y) => {
  x = Math.max(0, Math.min(img.width - 1, x))
  y = Math.max(0, Math.min(img.height - 1, y))
  const i = (img.width * y + x) << 2
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]
}
const sample = (img, u, v) => {
  const fx = u * (img.width - 1), fy = v * (img.height - 1)
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  const dx = fx - x0, dy = fy - y0
  const a = px(img, x0, y0), b = px(img, x0 + 1, y0), c = px(img, x0, y0 + 1), d = px(img, x0 + 1, y0 + 1)
  const out = []
  for (let k = 0; k < 4; k++) {
    const top = a[k] * (1 - dx) + b[k] * dx
    const bot = c[k] * (1 - dx) + d[k] * dx
    out[k] = Math.round(top * (1 - dy) + bot * dy)
  }
  return out
}
function make(size, scale, bg) {
  const out = new PNG({ width: size, height: size })
  const inner = Math.round(size * scale)
  const off = Math.round((size - inner) / 2)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2
      const ix = x - off, iy = y - off
      if (bg && (ix < 0 || iy < 0 || ix >= inner || iy >= inner)) {
        out.data[i] = bg[0]; out.data[i + 1] = bg[1]; out.data[i + 2] = bg[2]; out.data[i + 3] = 255
        continue
      }
      const u = Math.min(0.999999, Math.max(0, ix / inner))
      const v = Math.min(0.999999, Math.max(0, iy / inner))
      const [r, g, b, al] = sample(src, u, v)
      if (bg && al < 255) {
        const a = al / 255
        out.data[i] = Math.round(r * a + bg[0] * (1 - a))
        out.data[i + 1] = Math.round(g * a + bg[1] * (1 - a))
        out.data[i + 2] = Math.round(b * a + bg[2] * (1 - a))
        out.data[i + 3] = 255
      } else {
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = al
      }
    }
  return PNG.sync.write(out)
}
const BG = [15, 19, 32] // #0f1320
const dir = 'src/renderer/public'
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(`${dir}/icon-192.png`, make(192, 1, null))
fs.writeFileSync(`${dir}/icon-512.png`, make(512, 1, null))
fs.writeFileSync(`${dir}/icon-maskable-512.png`, make(512, 0.78, BG))
fs.writeFileSync(`${dir}/apple-touch-icon.png`, make(180, 1, BG))
console.log(
  'icons:',
  fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => {
    const p = PNG.sync.read(fs.readFileSync(dir + '/' + f))
    return `${f}(${p.width})`
  }).join(', ')
)
