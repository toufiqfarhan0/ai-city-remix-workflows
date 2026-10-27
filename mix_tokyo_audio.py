import os
import subprocess

audio_dir = "tokyo-film/audio"
out_audio = "tokyo-film/audio/full_narration.mp3"

# Delays in milliseconds for each segment
# Landmark interval: 7.5 seconds = 7500ms
delays = [
    0,      # seg0 @ 0.0s
    7500,   # seg1 @ 7.5s
    15000,  # seg2 @ 15.0s
    22500,  # seg3 @ 22.5s
    30000,  # seg4 @ 30.0s
    37500,  # seg5 @ 37.5s
    45000,  # seg6 @ 45.0s
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

print("Running ffmpeg mix command...")
res = subprocess.run(cmd)
if res.returncode == 0:
    print(f"Successfully generated {out_audio}!")
else:
    print(f"FFmpeg failed with return code {res.returncode}")
