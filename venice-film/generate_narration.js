import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'seg0', text: "Across the shimmering mirror of the Venetian Lagoon, the Ponte della Libertà stretches four kilometres toward the sea." },
  { id: 'seg1', text: "Built in nineteen thirty-three by Eugenio Miozzi, this slender causeway carries the only road connecting the mainland to Venice." },
  { id: 'seg2', text: "To our left and right, historic batteries and wooden briccole guide fishermen through the ancient salt marshes." },
  { id: 'seg3', text: "As the road approaches Santa Chiara, the open lagoon yields to the stone embankments of Cannaregio." },
  { id: 'seg4', text: "Ahead across the Grand Canal, the great copper dome of San Simeon Piccolo rises like a temple above the water." },
  { id: 'seg5', text: "At Sant’Andrea della Zirada, fourteenth-century Gothic walls mark the boundary where asphalt ends and Venice begins." },
  { id: 'seg6', text: "Here at Piazzale Roma, every engine falls silent, handing the traveler over to gondolas, bridges, and labyrinthine stone." }
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

console.log('All Venice narration segments processed.');
