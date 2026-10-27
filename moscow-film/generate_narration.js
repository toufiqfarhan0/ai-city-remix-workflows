import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'seg0', text: "At the geographic and historical heart of Russia, the brick towers and gilded cathedrals of the Moscow Kremlin command the bend of the Moskva River." },
  { id: 'seg1', text: "Outside the Spasskaya Tower lies Red Square, anchored by the iconic patterned onion domes of the sixteenth-century Saint Basil’s Cathedral." },
  { id: 'seg2', text: "Centuries of defense shaped Moscow’s unique urban anatomy, radiating outward in concentric defensive belts." },
  { id: 'seg3', text: "Following the fire of eighteen twelve, the medieval stone walls of the White City were transformed into the tree-lined Boulevard Ring." },
  { id: 'seg4', text: "Further outward lies the sixteen-kilometer Garden Ring, tracing the ancient earthen ramparts built under Boris Godunov." },
  { id: 'seg5', text: "In the twentieth century, monumental Stalinist skyscrapers like the Kotelnicheskaya Embankment Building punctuated the skyline." },
  { id: 'seg6', text: "From medieval citadel to radial modern metropolis, Moscow’s geometry stands as an enduring map of time and ambition." }
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
    console.error('Failed to parse CLI output for ' + seg.id + ':', res.stderr || res.stdout);
    continue;
  }

  const url = data?.output?.[0]?.url;
  if (!url) {
    console.error('No audio URL returned for ' + seg.id + ':', data);
    continue;
  }
  console.log(`Downloading audio from ${url}...`);
  const curlRes = spawnSync('curl', ['-fsSL', '--ssl-no-revoke', '-o', outMp3, url], { shell: true });
  if (curlRes.status === 0) {
    console.log(`Saved ${outMp3} successfully.`);
  } else {
    console.error(`Failed to download audio for ${seg.id}`);
  }
}

console.log('All Moscow narration segments processed.');
