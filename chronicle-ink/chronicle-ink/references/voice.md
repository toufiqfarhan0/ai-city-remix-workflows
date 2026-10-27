# Narration (opt-in)

Only when the user asks for a voice-over. Each caption is spoken once over its own shot.

1. Finish the script first: the gate checks captions, and the voice must say exactly the caption.
2. Generate one clip per shot with a SandBase speech model (for example `minimax/speech/2.8/hd`,
   `english_normalization: true` for dates, a calm narrator voice, speed about 1.05), through the
   `sandbase` CLI or API only. Save them as `voice/<shot>.mp3`.
3. Write `voice/voice.json`:

```json
{
  "generated": { "model": "minimax/speech/2.8/hd", "via": "SandBase", "voice_id": "English_CaptivatingStoryteller", "speed": 1.05 },
  "credit": { "en": "Narration: MiniMax Speech 2.8 HD (via SandBase)", "zh-CN": "旁白：MiniMax Speech 2.8 HD 合成（经 SandBase）" },
  "lines": [{ "shot": "S01", "file": "voice/S01.mp3", "text": "This is a white model of central Rome today.", "offset": 0.25 }]
}
```

The render places each clip `offset` seconds (default 0.25) after its shot starts, trims silence,
levels it to −15 LUFS and ducks the music by 9 dB under it. It fails with `voice_mismatch` when a
line's text is not its shot's caption and with `voice_too_long` when a clip runs into the next shot
(about 2.7 English words per second fit; shorten the caption or raise the speed). The end card credits
the voice and the report counts one model call per line. Regenerate a line whenever its caption
changes.
