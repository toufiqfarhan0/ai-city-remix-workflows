import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'seg0', text: "At sunrise, we enter Jaffa Gate, where Ottoman limestone opens Jerusalem’s ancient heart." },
  { id: 'seg1', text: "Beyond the walls, Teddy Park unfurls green terraces and a fountain through the waking city." },
  { id: 'seg2', text: "At midday, the Citadel rises, pairing Phasael’s ancient tower with a slender Ottoman minaret." },
  { id: 'seg3', text: "Afternoon light settles on the Holy Sepulchre, where twin domes hold centuries of prayer." },
  { id: 'seg4', text: "At dusk, the Western Wall glows gold, its prayer plaza humming with whispered devotion." },
  { id: 'seg5', text: "Twilight crowns the Dome of the Rock, its gilded octagon glowing above the sacred city." },
  { id: 'seg6', text: "Night deepens as Al-Aqsa’s lead dome rests among ancient pines and quiet courtyards." },
  { id: 'seg7', text: "Under starlight, olive groves on the Mount of Olives reveal Jerusalem’s whole luminous story." }
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
