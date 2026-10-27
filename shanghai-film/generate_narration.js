import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const segments = [
  { id: 'intro', text: "This is Shanghai today where the Huangpu curves past the Bund into Pudong. Let us take every building away, and watch it rise from mudflats into the sky." },
  { id: 'era1_treaty_port', text: "Along the western mudflats of the Huangpu, international merchants laid the first stone quays of the Bund." },
  { id: 'era2_bund_stone', text: "Granite banks, the Customs clock tower, and the art-deco crown of the Peace Hotel transformed Shanghai into Paris of the East." },
  { id: 'era3_farmland_quiet', text: "For fifty years, while the western shore hummed with density, the eastern peninsula of Pudong remained quiet farmland, warehouses, and shipyards." },
  { id: 'era4_pudong_awakening', text: "In nineteen ninety, China designated Pudong a Special Economic Zone. Four years later, the Oriental Pearl Tower sparked a vertical renaissance." },
  { id: 'era5_jinmao_pagoda', text: "Rising eighty-eight storeys, Jin Mao Tower joined traditional Chinese pagoda symmetry with eighty-eight floors of steel and glass." },
  { id: 'era6_supertall_trinity', text: "The World Financial Center carved a portal into the clouds, before the spiraling dragon form of Shanghai Tower topped out at six hundred thirty-two metres." },
  { id: 'era7_vertical_metropolis', text: "Across two centuries of water and ambition, Shanghai built the highest density of human ingenuity on earth." },
  { id: 'outro', text: "In thirty years, Pudong transformed from farmland into the world's most dramatic vertical skyline." }
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

console.log('All Shanghai narration segments processed.');
