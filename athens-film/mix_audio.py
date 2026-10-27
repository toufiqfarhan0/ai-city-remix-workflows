import os
import subprocess

audio_dir = "audio"
out_audio = "audio/full_narration.mp3"

# Delays in milliseconds matching subtitles.srt
delays = [
    500,    # seg0 @ 0.5s
    7500,   # seg1 @ 7.5s
    14500,  # seg2 @ 14.5s
    21500,  # seg3 @ 21.5s
    29000,  # seg4 @ 29.0s
    37000,  # seg5 @ 37.0s
    44500,  # seg6 @ 44.5s
    52500   # seg7 @ 52.5s
]

cmd = ['ffmpeg', '-y', '-loglevel', 'error']
filter_complex = []

for i in range(8):
    cmd.extend(['-i', f"{audio_dir}/seg{i}.mp3"])
    filter_complex.append(f"[{i}]adelay={delays[i]}|{delays[i]}[a{i}]")

inputs_str = "".join(f"[a{i}]" for i in range(8))
filter_complex.append(f"{inputs_str}amix=inputs=8:duration=longest:dropout_transition=2,volume=1.3[out]")

cmd.extend([
    '-filter_complex', ";".join(filter_complex),
    '-map', '[out]',
    '-t', '60.0',
    '-c:a', 'libmp3lame',
    '-b:a', '192k',
    out_audio
])

print("Running ffmpeg mix command for Athens...")
res = subprocess.run(cmd)
if res.returncode == 0:
    print(f"Successfully generated {out_audio}!")
else:
    print(f"FFmpeg failed with return code {res.returncode}")
