import os
import subprocess

audio_dir = "audio"
out_audio = "audio/full_narration.mp3"

delays = [
    500,    # seg0 @ 0.5s
    8500,   # seg1 @ 8.5s
    17000,  # seg2 @ 17.0s
    25500,  # seg3 @ 25.5s
    34000,  # seg4 @ 34.0s
    42500,  # seg5 @ 42.5s
    51000   # seg6 @ 51.0s
]

cmd = ['ffmpeg', '-y', '-loglevel', 'error']
filter_complex = []

for i in range(7):
    cmd.extend(['-i', f"{audio_dir}/seg{i}.mp3"])
    filter_complex.append(f"[{i}]adelay={delays[i]}|{delays[i]}[a{i}]")

inputs_str = "".join(f"[a{i}]" for i in range(7))
filter_complex.append(f"{inputs_str}amix=inputs=7:duration=longest:dropout_transition=2,volume=1.3[out]")

cmd.extend([
    '-filter_complex', ";".join(filter_complex),
    '-map', '[out]',
    '-t', '60.0',
    '-c:a', 'libmp3lame',
    '-b:a', '192k',
    out_audio
])

print("Running ffmpeg mix command for Moscow...")
res = subprocess.run(cmd)
if res.returncode == 0:
    print(f"Successfully generated {out_audio}!")
else:
    print(f"FFmpeg failed with return code {res.returncode}")
