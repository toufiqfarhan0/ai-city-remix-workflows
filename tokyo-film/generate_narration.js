import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'seg0', text: "At dawn, Emi follows the map’s blue line toward civic stone waking silver between the twin towers." },
  { id: 'seg1', text: "Morning gathers at Park Tower, where warm coffee steadies Emi and granite steps divide the city into terraces." },
  { id: 'seg2', text: "By late morning, Nomura’s fins turn Emi’s route into a chart, each window marking someone’s work." },
  { id: 'seg3', text: "At noon, Emi eats beneath Center Building’s glass skin, briefly inside a city perfectly ordered." },
  { id: 'seg4', text: "Afternoon sharpens on Mitsui’s black X-braces, while Emi’s messages pulse like small private stars behind the façade." },
  { id: 'seg5', text: "At dusk, Cocoon Tower wraps Emi in woven light, its curving lattice turning traffic into one luminous thread." },
  { id: 'seg6', text: "Evening, Miraina Tower lifts Emi above the rails; every arriving train stitches another life into the map." },
  { id: 'seg7', text: "By night, Kabukicho Tower’s fountain conducts the crowds, and Emi closes her map on the city’s electric pulse." }
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
