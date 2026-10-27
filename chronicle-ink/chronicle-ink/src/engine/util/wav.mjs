// RIFF/WAVE writer (PCM 16-bit) and reader (PCM 16/24/32-bit and 32-bit float). Dependency-free.
// Used by the mock transport (fake music and voice lines) and by tests.

/**
 * Interleaves channel sample arrays (floats in [-1, 1], clipped) into a PCM 16-bit WAV buffer.
 * @param {ArrayLike<number>[]} channels one array per channel, equal lengths
 * @param {number} sampleRate
 */
export function encodeWav(channels, sampleRate) {
  if (!channels.length) throw new TypeError('at least one channel is required')
  const n = channels[0].length
  for (const c of channels) if (c.length !== n) throw new TypeError('channels must have equal length')
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new TypeError('sampleRate must be a positive integer')
  const ch = channels.length
  const data = Buffer.alloc(n * ch * 2)
  for (let i = 0, o = 0; i < n; i++) {
    for (let c = 0; c < ch; c++, o += 2) {
      const v = Math.max(-1, Math.min(1, Number(channels[c][i]) || 0))
      data.writeInt16LE(v < 0 ? Math.round(v * 32768) : Math.round(v * 32767), o)
    }
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0, 'ascii')
  head.writeUInt32LE(36 + data.length, 4)
  head.write('WAVE', 8, 'ascii')
  head.write('fmt ', 12, 'ascii')
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20) // WAVE_FORMAT_PCM
  head.writeUInt16LE(ch, 22)
  head.writeUInt32LE(sampleRate, 24)
  head.writeUInt32LE(sampleRate * ch * 2, 28)
  head.writeUInt16LE(ch * 2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36, 'ascii')
  head.writeUInt32LE(data.length, 40)
  return Buffer.concat([head, data])
}

/** Parses a WAV buffer -> { sampleRate, bits, format, channels: Float32Array[], duration }. */
export function decodeWav(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file')
  let fmt = null
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    let size = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ') {
      let format = buf.readUInt16LE(body)
      if (format === 0xfffe) format = buf.readUInt16LE(body + 24) // WAVE_FORMAT_EXTENSIBLE sub-format
      fmt = { format, channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) }
    } else if (id === 'data' && fmt) {
      if (size === 0xffffffff || body + size > buf.length) size = buf.length - body // streamed writers
      const bytes = fmt.bits / 8
      if (!(fmt.format === 1 && [2, 3, 4].includes(bytes)) && !(fmt.format === 3 && bytes === 4)) throw new Error(`unsupported WAV: format ${fmt.format}, ${fmt.bits} bit`)
      const n = Math.floor(size / (bytes * fmt.channels))
      const out = Array.from({ length: fmt.channels }, () => new Float32Array(n))
      for (let i = 0, o = body; i < n; i++) {
        for (let c = 0; c < fmt.channels; c++, o += bytes) {
          let v
          if (fmt.format === 3) v = buf.readFloatLE(o)
          else if (bytes === 2) v = buf.readInt16LE(o) / 32768
          else if (bytes === 3) v = buf.readIntLE(o, 3) / 8388608
          else v = buf.readInt32LE(o) / 2147483648
          out[c][i] = v
        }
      }
      return { sampleRate: fmt.sampleRate, bits: fmt.bits, format: fmt.format, channels: out, duration: n / fmt.sampleRate }
    }
    off = body + size + (size & 1)
  }
  throw new Error('WAV without fmt/data chunks')
}
