import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'seg0', text: "On starlit Acropolis rock, ancient Athens begins its long remembering in stone." },
  { id: 'seg1', text: "At the Propylaea gate, each arriving step carries the echo of worshippers." },
  { id: 'seg2', text: "On Athena Nike’s bastion, victory takes wing above the city’s restless centuries." },
  { id: 'seg3', text: "Beside the Erechtheion Caryatids, patient stone figures bear the weight of memory." },
  { id: 'seg4', text: "Then dawn touches the Parthenon, and the marble of Pericles becomes a living chronicle." },
  { id: 'seg5', text: "Below, the Odeon gathers empty seats around voices that outlive their audiences." },
  { id: 'seg6', text: "As sunrise climbs the peristyle, the sacred hill reveals its many lives at once." },
  { id: 'seg7', text: "By radiant day, Athens carries every vanished world forward beneath the same blue heavens." }
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

console.log('All Athens narration segments processed.');
