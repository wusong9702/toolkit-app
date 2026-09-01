/**
 * 生成 PWA 需要的 PNG 图标（纯 Node 实现，不装任何依赖）
 * 用法：node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../app/public/icons')

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** 画一个渐变圆角方块 + 三条白色横杠的图标 */
function makePixels(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const r = Math.round(size * 0.22)
  const bars = [
    { y: 0.28, h: 0.095, x0: 0.22, x1: 0.78, a: 1.0 },
    { y: 0.45, h: 0.095, x0: 0.22, x1: 0.63, a: 0.82 },
    { y: 0.62, h: 0.095, x0: 0.22, x1: 0.48, a: 0.64 },
  ]

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < size; x++) {
      const fx = x / size
      const fy = y / size

      // 渐变背景
      const t = Math.min(1, Math.max(0, (fx + fy) / 2))
      let R = Math.round(0x19 + (0x4f - 0x19) * t)
      let G = Math.round(0x89 + (0xac - 0x89) * t)
      let B = Math.round(0xfa + (0xfe - 0xfa) * t)
      let A = 255

      // 圆角
      const inCorner =
        (x < r && y < r && Math.hypot(r - x, r - y) > r) ||
        (x > size - r && y < r && Math.hypot(x - (size - r), r - y) > r) ||
        (x < r && y > size - r && Math.hypot(r - x, y - (size - r)) > r) ||
        (x > size - r && y > size - r && Math.hypot(x - (size - r), y - (size - r)) > r)
      if (inCorner) A = 0

      // 白色横杠
      for (const b of bars) {
        if (fy >= b.y && fy <= b.y + b.h && fx >= b.x0 && fx <= b.x1) {
          R = 255
          G = 255
          B = 255
          A = Math.round(255 * b.a)
        }
      }

      const p = rowStart + 1 + x * 4
      raw[p] = R
      raw[p + 1] = G
      raw[p + 2] = B
      raw[p + 3] = A
    }
  }
  return raw
}

function makePng(size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(makePixels(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of [192, 512]) {
  const file = resolve(OUT_DIR, `icon-${size}.png`)
  writeFileSync(file, makePng(size))
  console.log('已生成', file)
}
console.log('图标生成完成')
