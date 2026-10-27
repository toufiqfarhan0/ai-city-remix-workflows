// The 24-second score as the tour's soundtrack. The AudioContext is created inside a user gesture
// (sound button or Play tour); before that the state is 'uninitialised' and nothing is decoded.
// The MP3 is inlined by the build and decoded from bytes, so no request leaves the page.
import scoreUrl from '../assets/score.mp3';

function bytesFromDataUrl(url) {
  const comma = url.indexOf(',');
  const bin = atob(url.slice(comma + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function createScore() {
  let ctx = null, gain = null, buffer = null, source = null, decoding = null;
  let muted = true, wantAt = null;
  const errors = [];

  function stopSource() {
    if (!source) return;
    try { source.stop(); } catch { /* already stopped */ }
    source.disconnect();
    source = null;
  }
  function startAt(offset) {
    stopSource();
    if (!ctx || !buffer || muted || offset === null || offset >= buffer.duration) return;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(0, Math.max(0, offset));
  }
  return {
    /** Call from a gesture handler: creates the context and starts decoding. */
    init() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume().catch((e) => errors.push(String(e)));
        return;
      }
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      gain = ctx.createGain();
      gain.gain.value = 0.9;
      gain.connect(ctx.destination);
      decoding = ctx.decodeAudioData(bytesFromDataUrl(scoreUrl)).then((b) => {
        buffer = b;
        if (wantAt !== null) startAt(wantAt);
      }).catch((e) => errors.push(String(e)));
    },
    /** Follow the tour: `at` is the tour time in seconds, or null when the tour is not playing. */
    follow(at) {
      wantAt = at;
      if (buffer) startAt(at);
    },
    setMuted(m) {
      muted = !!m;
      if (muted) stopSource();
      else if (wantAt !== null && buffer) startAt(wantAt);
    },
    get muted() { return muted; },
    get state() { return ctx?.state ?? 'uninitialised'; },
    get ready() { return decoding; },
    errors,
  };
}
