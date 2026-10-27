import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)));
const htmlFile = resolve(APP, 'work/scenes/project/index.html');
const projectDir = resolve(APP, 'work/scenes/project');
const outDir = resolve(APP, 'film');
mkdirSync(outDir, { recursive: true });

const html = readFileSync(htmlFile);
const server = createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/' || urlPath === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  const filePath = join(projectDir, urlPath);
  if (existsSync(filePath)) {
    res.writeHead(200);
    res.end(readFileSync(filePath));
    return;
  }
  res.writeHead(404).end();
});

await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

const defaultChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { chromium } = await import('../moscow-film/node_modules/playwright-core/index.mjs');

const browser = await chromium.launch({
  executablePath: defaultChrome,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(0);
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.CI_RENDER === 'function', null, { timeout: 30000 });

const framesDir = join(outDir, 'raw_frames');
mkdirSync(framesDir, { recursive: true });

const totalFrames = 1800; // 60 seconds at 30 fps
const fps = 30;

console.log(`Starting frame recording for Bangkok (1800 frames, 60.0s @ 30fps)...`);

try {
  for (let i = 0; i < totalFrames; i++) {
    const frameFile = join(framesDir, `f${String(i).padStart(5, '0')}.jpg`);
    if (i % 100 === 0) {
      console.log(`Stepping frame ${i}/${totalFrames} (${((i / totalFrames) * 100).toFixed(1)}%)...`);
    }
    const t = i / fps;
    await page.evaluate((time) => window.CI_RENDER(time), t);

    if (existsSync(frameFile)) {
      continue;
    }
    const buf = await page.screenshot({ type: 'jpeg', quality: 90, timeout: 0 });
    writeFileSync(frameFile, buf);
  }

  const rawVideo = join(outDir, 'film_raw.mp4');
  console.log(`Encoding raw video to ${rawVideo}...`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-framerate', String(fps),
    '-i', join(framesDir, 'f%05d.jpg'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '19',
    '-r', String(fps),
    '-movflags', '+faststart',
    '-an',
    rawVideo
  ]);

  // Poster at 20.0s (frame 600)
  copyFileSync(join(framesDir, 'f00600.jpg'), join(APP, 'cover.jpg'));
  copyFileSync(join(framesDir, 'f00600.jpg'), resolve(APP, '../assets/covers/bangkok_cover.jpg'));
  console.log(`Saved official cover.jpg successfully.`);

} finally {
  await browser.close();
  server.close();
}
