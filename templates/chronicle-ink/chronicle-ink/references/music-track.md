# Music track (opt-in)

By default the music stage synthesises the style's series theme. Only when the user asks for it, put
an audio file in the project's `music/` folder and describe it in `music/track.json`; the music stage
then uses that file instead.

```json
{
  "file": "music/rome-score.mp3",
  "start": 0,
  "fade_in": 1.5,
  "fade_out": 4,
  "title": "Rome documentary score",
  "by": "MiniMax Music 2.6",
  "licence": "generated",
  "source": null,
  "generated": { "model": "minimax/music/2.6", "via": "SandBase", "run_id": "…", "prompt": "…" },
  "credit": {
    "en": "Music: instrumental generated with MiniMax Music 2.6 (via SandBase)",
    "zh-CN": "音乐：MiniMax Music 2.6 生成的器乐（经 SandBase）"
  }
}
```

- `file` must be inside `music/`. `start` is the second to cut from; the stage takes the film length
  from there, fades in and out and levels it to −16 LUFS before the usual mix and −14 LUFS master.
- `licence` is one of `public-domain`, `cc0`, `cc-by-3.0`, `cc-by-4.0` or `generated`. NC, ND and SA
  recordings are not accepted: the film is a derivative work that may be used commercially. For CC BY,
  `credit` must name the title, author, licence and source page.
- `generated` records the model, the run id and the prompt. Generate **instrumentals only** (no
  vocals: they fight the captions), through the `sandbase` CLI or API, never another vendor's key.
  Describe the film's arc in the prompt (quiet opening, growth, peak, a sparse dip, a second rise, soft
  ending) and its length; a model may return a longer piece, choose `start` so the ending lands.
- The beat map stays the authored 88 BPM grid, so cuts and SFX keep their timing but no longer sit on
  the track's own beats. Prefer calm, loosely pulsed music, where this is not audible.
- The end card's AIGC line then only claims the pictures, and the `credit` line follows it; the report
  lists the track under music.
