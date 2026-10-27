import os
import subprocess
import json

def mux():
    video_in = "film/film.mp4"
    audio_in = "audio/full_narration.mp3"
    subtitles = "subtitles.srt"
    video_out = "film/athens_final.mp4"

    if not os.path.exists(video_in):
        print(f"Error: {video_in} not found.")
        return False

    if not os.path.exists(audio_in):
        print(f"Error: {audio_in} not found.")
        return False

    # Burn subtitles and mux audio
    subtitle_filter = "subtitles=subtitles.srt:force_style='FontSize=22,FontName=Arial,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,MarginV=45'"

    cmd = [
        'ffmpeg', '-y', '-loglevel', 'error',
        '-i', video_in,
        '-i', audio_in,
        '-vf', subtitle_filter,
        '-af', 'apad=whole_dur=60.0',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-t', '60.0',
        '-movflags', '+faststart',
        video_out
    ]

    print("Running mux command for Athens...")
    res = subprocess.run(cmd)
    if res.returncode != 0:
        print(f"FFmpeg failed with return code {res.returncode}")
        return False

    size_mb = os.path.getsize(video_out) / (1024 * 1024)
    print(f"Successfully created {video_out} ({size_mb:.2f} MiB)")

    # Verify with ffprobe
    probe_cmd = [
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration,size:stream=width,height,codec_name',
        '-of', 'json', video_out
    ]
    probe_res = subprocess.run(probe_cmd, capture_output=True, text=True)
    if probe_res.returncode == 0:
        info = json.loads(probe_res.stdout)
        duration = float(info['format']['duration'])
        print(f"Verified film duration: {duration:.2f}s (must be between 60.0s and 180.0s)")
        for stream in info.get('streams', []):
            print(f"  Stream: {stream.get('codec_name')} {stream.get('width', '')}x{stream.get('height', '')}")
    return True

if __name__ == '__main__':
    mux()
