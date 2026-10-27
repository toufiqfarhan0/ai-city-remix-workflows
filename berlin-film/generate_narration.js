import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'seg0', text: "At Pariser Platz, a chalked footprint waits for sandstone, history, and a city’s hope." },
  { id: 'seg1', text: "Twelve Doric columns rise, framing five passages where every Berlin traveler becomes a pilgrim." },
  { id: 'seg2', text: "In seventeen ninety-one, Langhans translated Athens’ Propylaea into sandstone, ceremony, and open welcome." },
  { id: 'seg3', text: "Above, Schadow’s copper Quadriga crowns the roof, Victoria riding four horses through open sky." },
  { id: 'seg4', text: "Then war leaves its scars, while emptiness circles this Cold War threshold." },
  { id: 'seg5', text: "On November ninth, nineteen eighty-nine, the Wall falls and this threshold breathes again." },
  { id: 'seg6', text: "Today, footsteps, wheels, voices, and flags restore unity to the passages once sealed by fear." },
  { id: 'seg7', text: "We return to Pariser Platz as dusk gathers, the floodlit Gate holding tomorrow in stone." }
];

const audioDir = join(process.cwd(), 'audio');
mkdirSync(audioDir, { recursive: true });

for (const seg of segments) {
  const outMp3 = join(audioDir, `${seg.id}.mp3`);
  if (existsSync(outMp3)) {
    console.log(`${seg.id}.mp3 already exists, skipping.`);
    continue;
  }
  console.log(`Generating TTS for ${seg.id}: "${seg.text}"`);
  const payload = {
    text: seg.text,
    voice_id: 'English_CaptivatingStoryteller',
    emotion: 'neutral',
    speed: 1.05,
    language_boost: 'English',
    format: 'mp3',
    sample_rate: 44100
  };
  const tmpJson = join(audioDir, `temp_${seg.id}.json`);
  writeFileSync(tmpJson, JSON.stringify(payload, null, 2));

  const res = spawnSync('npx', ['-y', '@sandbaseai/cli@latest', 'run', 'sandbase_minimax_speech_2_8_hd', '-f', tmpJson, '-w', '--timeout', '400', '-j'], {
    shell: true,
    encoding: 'utf8',
    maxBuffer: 1 << 26
  });

  let data;
  try {
    data = JSON.parse(res.stdout);
  } catch (err) {
    console.error('Failed to parse CLI output:', res.stderr || res.stdout);
    continue;
  }

  const url = data?.output?.[0]?.url;
  if (!url) {
    console.error('No audio URL returned:', data);
    continue;
  }
  console.log(`Downloading audio from ${url}...`);
  const curlRes = spawnSync('curl', ['-fsSL', '-o', outMp3, url], { shell: true });
  if (curlRes.status === 0) {
    console.log(`Saved ${outMp3} successfully.`);
  } else {
    console.error(`Curl download failed for ${seg.id}`);
  }
}

console.log('All narration segments processed.');
