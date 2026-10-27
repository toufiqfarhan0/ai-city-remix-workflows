# Music: the series theme and SFX

## Ink Theme

One fixed, code-synthesized tune is the recognisable signature of every ink film
(`src/engine/audio/theme.mjs`). It is never re-composed per film; `music` renders it for the film length and
writes the authored beat map.

| | |
|---|---|
| Key / mode | D gong pentatonic (D E F♯ A B) |
| Tempo | 88 BPM, 4/4, bar ≈ 2.727 s |
| Voices | guqin-like Karplus-Strong pluck with body resonance, harmonics (fanyin), xiao-like breathy flute with delayed vibrato, low frame drums, woodblock, string pad, bass, bronze bell |
| Motifs | M1 call (A B D E · D B A F♯ A), M2 answer, M3 descent; 4-bar harmony loop D – Bm – Em(sus) – A |
| Sections | intro (plucked arpeggios, flute) · verse (ostinato, motif on the flute, soft drum) · build (rising drums, shaker) · drop (full: drums on 1 and 3, motif on flute + guqin) · breakdown (pad, flute, harmonics) · build2 · drop2 (+ bell counter-line) · outro (motif, final D chord, bell) |

Arrangements (bars): 120 s 4·8·4·8·6·2·8·4, 150 s 4·12·4·8·8·4·8·7, 180 s 4·16·4·8·12·4·12·6. Sections
are written bar by bar, so repeating or trimming a section changes only how many of its bars play.

`work/music/beatmap.json` holds `bpm`, `beat_s`, `bar_s`, every beat and downbeat time and each section's
start bar and time. It is exact by construction; no beat tracking is involved.

## Mix and loudness

The theme is gain-staged to about −16 LUFS, lightly compressed and soft-clipped. `render` adds the SFX
cues (each cue's hit sample on its action time, climax cues dip the music 3 dB for 0.4 s), then a two-pass
ffmpeg loudnorm to −14 LUFS / −1.5 dBTP / LRA 11 at 48 kHz stereo. `check` measures the film with
ebur128 (gate: I −15…−13 LUFS, TP ≤ −1.0 dBTP).

## SFX kit (`src/engine/audio/sfx.mjs`)

| Kind | Sound | Hit |
|---|---|---|
| transition | brush swish + soft drum | start |
| appear | pitched wood tick in the theme scale | start |
| count | rising ticks through the count, a harmonic on the final value | end of the count |
| seal | pressure swell, wooden thump, paper rustle | after an 80 ms swell |
| route | brush drag rising in pitch, tick at the destination | start |
| reveal | reverse swell into a drum + harmonic | after a 0.6 s swell |
| brush | dry brush stroke | start |
| scroll | paper flutter + wooden roll | start |

Tiers: normal −20 dBFS peak; emphasis −13 dBFS + a theme-scale harmonic; climax −7 dBFS + frame drum +
bell. Some layers share code with `skills/sketchbook-film` (same repository).

## What the checks prove and what they do not

`check` proves: loudness and true peak, every shot and section start on a downbeat frame, and every SFX
onset (steepest rise of the 4 ms RMS envelope on the SFX stem) within one frame of its cue. It does not
prove that the music and the mix sound good. A person still has to listen before publishing.
