import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'seg0', text: "High above the curving Vltava River, Prague began in the ninth century when Prince Bořivoj laid the stone ramparts of Prague Castle." },
  { id: 'seg1', text: "By the fourteenth century, Holy Roman Emperor Charles the Fourth transformed Prague into the imperial jewel of Central Europe." },
  { id: 'seg2', text: "Master mason Peter Parler erected the soaring sandstone arches of the Charles Bridge, spanning over five hundred meters across the river." },
  { id: 'seg3', text: "Within the castle walls, St. Vitus Cathedral rose with daring Gothic rib vaults, safeguarding the sacred Bohemian Crown Jewels." },
  { id: 'seg4', text: "During the Renaissance, Emperor Rudolf the Second welcomed alchemists and astronomers Johannes Kepler and Tycho Brahe to study the heavens." },
  { id: 'seg5', text: "Thirty expressive Baroque statues of saints were carved along the parapets of the bridge, while golden spires multiplied across the hills." },
  { id: 'seg6', text: "Completed across six centuries and inscribed as a UNESCO World Heritage site, Prague endures as the immortal City of a Hundred Spires." }
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

console.log('All Prague narration segments processed.');
