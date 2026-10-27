import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'seg0', text: "Along the gentle curve of the Chao Phraya River, the historic story of Bangkok began as a bustling trading post." },
  { id: 'seg1', text: "In 1782, King Rama I established his new royal capital on Rattanakosin Island, founding the Chakri dynasty." },
  { id: 'seg2', text: "Within protective river moats rose the Grand Palace and Wat Phra Kaew, enshrining the sacred Emerald Buddha." },
  { id: 'seg3', text: "Nearby, the ancient temple of Wat Pho safeguarded classical Buddhist scriptures, medicine, and monastic arts." },
  { id: 'seg4', text: "Across the river in Thonburi, the porcelain-encrusted central spire of Wat Arun rose high into the morning sky." },
  { id: 'seg5', text: "Throughout the centuries, intricate canal networks transformed the capital into the vibrant Venice of the East." },
  { id: 'seg6', text: "From royal citadel to thriving modern metropolis, Bangkok endures as an immortal city along the River of Kings." }
];

const audioDir = join(process.cwd(), 'audio');
mkdirSync(audioDir, { recursive: true });

for (const seg of segments) {
  const outMp3 = join(audioDir, `${seg.id}.mp3`);
  if (existsSync(outMp3)) {
    console.log(`${seg.id}.mp3 already exists, skipping.`);
    continue;
  }
  console.log(`Generating MiniMax Speech 2.8 HD for ${seg.id}: "${seg.text}"`);
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
    console.error(`Failed to download ${outMp3}`);
  }
}
