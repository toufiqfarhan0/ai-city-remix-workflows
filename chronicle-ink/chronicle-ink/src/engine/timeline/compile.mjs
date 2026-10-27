// Timeline compiler: script.json (shot list) + the theme's beat grid -> work/timeline.json. Pure.
//
// Every time is derived from bars and beats of the theme (88 BPM) and quantised to whole frames:
//   shots     start on downbeats (start bar × bar length); transitions overlap the first beats of the
//             incoming shot (ink-bleed / scroll-pan 2 beats, seal-stamp 1 beat, cut 0)
//   captions  one block per shot: from shot start + lead (½ beat) to the shot end (the last shot's
//             caption ends where the end card begins); lines laid out per script (captions.mjs)
//   kp cards  from shot start + 1 beat to the shot end − ¼ beat; numeric cards count up over 2 beats
//   sfx       automatic cues for transitions, section drops, kp cards, the title and the end card, plus the
//             shot's own annotations (beat offsets from the shot start); duplicates within ½ beat of the
//             same kind keep the higher tier
//   segments  review segments for the director's loop: s1 = opening (intro, about 11 s), s2 verse,
//             s3 build + drop, s4 breakdown + build2, s5 drop2 + outro
import { barSeconds, compileBeatSheet } from '../story/beatsheet.mjs'
import { localized } from '../story/script-schema.mjs'
import { layoutCaption, textDirection, toVtt } from './captions.mjs'
export const TIMELINE_SCHEMA = 'chronicle-timeline/2'
export const FPS = 30
export const AIGC_BADGE_S = 3
export const TRANSITION_BEATS = Object.freeze({ cut: 0, 'ink-bleed': 2, 'scroll-pan': 2, 'seal-stamp': 1 })
export const SEGMENTS = Object.freeze([
  Object.freeze({ id: 's1', name: 'opening', sections: Object.freeze(['intro']) }),
  Object.freeze({ id: 's2', name: 'verse', sections: Object.freeze(['verse']) }),
  Object.freeze({ id: 's3', name: 'build-drop', sections: Object.freeze(['build', 'drop']) }),
  Object.freeze({ id: 's4', name: 'breakdown-build2', sections: Object.freeze(['breakdown', 'build2']) }),
  Object.freeze({ id: 's5', name: 'drop2-outro', sections: Object.freeze(['drop2', 'outro']) }),
])
const TIER_RANK = { normal: 0, emphasis: 1, climax: 2 }
const r3 = (x) => Math.round(x * 1000) / 1000
/**
 * @param {{ script: object, brief: { seconds, aspect, lang }, stylePack?: object, fps?: number }} input
 * @returns {object} timeline.json
 */
export function compileTimeline({ script, brief, stylePack = {}, fps = FPS }) {
  const plan = compileBeatSheet({ seconds: brief.seconds, aspect: brief.aspect, lang: brief.lang })
  const lang = brief.lang
  const barS = barSeconds(plan.bpm)
  const beatS = barS / 4
  const q = (t) => Math.round(t * fps) / fps
  const fr = (t) => Math.round(t * fps)
  const secById = new Map(plan.sections.map((s) => [s.id, s]))
  const used = new Map()
  const capStyle = stylePack.captions ?? {}
  const lead = (capStyle.lead_beats ?? 0.5) * beatS
  const endCardStart = q(plan.seconds - plan.end_card_bars * barS)
  const shots = []
  for (const s of script.shots) {
    const ps = secById.get(s.section)
    const at = used.get(ps.id) ?? 0
    used.set(ps.id, at + s.bars)
    const startBar = ps.start_bar + at
    const start = q(startBar * barS)
    const end = q((startBar + s.bars) * barS)
    shots.push({
      id: s.id, section: s.section, scene: s.scene, params: s.params ?? {}, size: s.size, camera: s.camera,
      transition: shots.length ? s.transition : 'cut', transition_s: shots.length ? q(TRANSITION_BEATS[s.transition] * beatS) : 0,
      start, end, start_frame: fr(start), end_frame: fr(end), start_bar: startBar, bars: s.bars,
      kp: s.kp ?? null, rehook: s.rehook === true, title: s.params?.title === true, description: s.description, claims: [...(s.claims ?? [])],
    })
  }
  // Captions.
  const captions = []
  script.shots.forEach((s, i) => {
    const cap = localized(s.caption, lang)
    if (!cap?.text) return
    const sh = shots[i]
    const lay = layoutCaption(cap.text, lang, capStyle)
    const end = i === shots.length - 1 ? Math.min(sh.end, endCardStart) : sh.end
    captions.push({ shot: s.id, start: q(sh.start + lead), end: q(end), lines: lay.lines, em: [...(cap.em ?? [])], dir: lay.dir })
  })
  // Knowledge-point cards.
  const kpById = new Map((script.knowledge_points ?? []).map((k) => [k.id, k]))
  const kpCards = []
  for (const sh of shots) {
    if (!sh.kp) continue
    const kp = kpById.get(sh.kp)
    const card = localized(kp?.card, lang) ?? {}
    kpCards.push({ id: sh.kp, shot: sh.id, start: q(sh.start + beatS), end: q(sh.end - beatS / 4), title: card.title ?? '', value: card.value ?? '', count: typeof kp?.count === 'number' ? kp.count : null, count_s: typeof kp?.count === 'number' ? q(2 * beatS) : 0 })
  }
  // SFX cues.
  const cues = []
  const cue = (shot, t, kind, tier, source, extra = {}) => cues.push({ shot, t: q(t), frame: fr(t), kind, tier, source, ...extra })
  shots.forEach((sh, i) => {
    const sectionStart = secById.get(sh.section).start_bar === sh.start_bar
    const drop = sectionStart && (sh.section === 'drop' || sh.section === 'drop2')
    if (drop) cue(sh.id, sh.start, 'reveal', 'climax', 'auto')
    else if (i > 0) {
      const kind = sh.transition === 'scroll-pan' ? 'scroll' : sh.transition === 'seal-stamp' ? 'seal' : 'transition'
      const tier = sh.transition === 'seal-stamp' || (sectionStart && sh.rehook) ? 'emphasis' : 'normal'
      cue(sh.id, sh.start, kind, tier, 'auto', { dur: r3(Math.max(beatS, sh.transition_s)) })
    }
    if (sh.title) cue(sh.id, sh.start + beatS, 'reveal', 'emphasis', 'auto')
    script.shots[i].sfx?.forEach((c, k) => cue(sh.id, sh.start + c.beat * beatS, c.kind, c.tier, 'shot', { ...(c.dur_beats ? { dur: r3(c.dur_beats * beatS) } : {}), step: k }))
  })
  for (const card of kpCards) {
    cue(card.shot, card.start, 'seal', 'emphasis', 'auto')
    if (card.count != null) cue(card.shot, card.start + card.count_s, 'count', 'emphasis', 'auto', { dur: card.count_s })
  }
  cue(shots[shots.length - 1].id, endCardStart, 'seal', 'emphasis', 'auto')
  cues.sort((a, b) => a.t - b.t || TIER_RANK[b.tier] - TIER_RANK[a.tier])
  const sfx = []
  for (const c of cues) {
    const dup = sfx.find((x) => x.kind === c.kind && Math.abs(x.t - c.t) < beatS / 2 - 1e-9)
    if (dup) {
      if (TIER_RANK[c.tier] > TIER_RANK[dup.tier]) dup.tier = c.tier
      continue
    }
    sfx.push(c)
  }
  sfx.forEach((c, i) => { c.id = `x${String(i + 1).padStart(3, '0')}` })
  const titleShot = shots.find((s) => s.title) ?? null
  const title = localized(script.title, lang) ?? ''
  const segments = SEGMENTS.map((g) => {
    const secs = g.sections.map((id) => secById.get(id))
    const start = q(secs[0].start_bar * barS)
    const end = g.sections.includes('outro') ? plan.seconds : q((secs[secs.length - 1].start_bar + secs[secs.length - 1].bars) * barS)
    return { id: g.id, name: g.name, sections: [...g.sections], start, end, from_frame: fr(start), to_frame: fr(end) }
  })
  return {
    schema: TIMELINE_SCHEMA,
    theme: plan.theme,
    seconds: plan.seconds,
    fps,
    frames: fr(plan.seconds),
    aspect: brief.aspect,
    lang,
    dir: textDirection(captions[0]?.lines?.[0] ?? title),
    bpm: plan.bpm,
    bar_s: r3(barS),
    beat_s: r3(beatS),
    sections: plan.sections.map((s) => ({ id: s.id, start: q(s.start_bar * barS), end: q((s.start_bar + s.bars) * barS), start_frame: fr(s.start_bar * barS), start_bar: s.start_bar, bars: s.bars })),
    shots,
    captions,
    kp_cards: kpCards,
    sfx,
    title: { text: title, shot: titleShot?.id ?? null, start: titleShot ? q(titleShot.start + beatS) : null, end: titleShot ? q(titleShot.end - beatS / 2) : null },
    end_card: { line: localized(script.end_card?.line, lang) ?? '', start: endCardStart, end: plan.seconds },
    badge: { kind: 'aigc', start: 0, end: AIGC_BADGE_S },
    rehooks: plan.rehooks,
    segments,
  }
}
/** WebVTT of the timeline's captions. */
export const timelineVtt = (timeline) => toVtt(timeline.captions)
/**
 * Resolves `--segment <id|name|section|start-end>` to { id, start, end } (seconds, frame-quantised).
 * `all` -> the whole film.
 */
export function resolveSegment(timeline, value) {
  const v = String(value ?? '').trim()
  if (v === 'all') return { id: 'all', start: 0, end: timeline.seconds }
  const seg = timeline.segments.find((s) => s.id === v || s.name === v)
  if (seg) return { id: seg.id, start: seg.start, end: seg.end }
  const sec = timeline.sections.find((s) => s.id === v)
  if (sec) return { id: sec.id, start: sec.start, end: sec.end }
  const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(v)
  if (m) {
    const q = (t) => Math.round(Number(t) * timeline.fps) / timeline.fps
    const start = q(m[1])
    const end = Math.min(timeline.seconds, q(m[2]))
    if (end - start >= 1) return { id: `${m[1]}-${m[2]}`.replace(/\./g, '_'), start, end }
  }
  return null
}
