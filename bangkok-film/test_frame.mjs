import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from '../moscow-film/node_modules/playwright-core/index.mjs';

const htmlFile = resolve('work/scenes/project/index.html');
const projectDir = resolve('work/scenes/project');

const server = createServer((req, res) => {
  let urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/' || urlPath === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(htmlFile));
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

await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist']
});

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.CI_RENDER === 'function');

// Render frame at 5 seconds
await page.evaluate(() => window.CI_RENDER(5.0));
await page.screenshot({ path: 'test_frame_5s.jpg', type: 'jpeg', quality: 90 });
console.log('Successfully captured test_frame_5s.jpg!');

// Render frame at 20 seconds (verse: Wat Arun / Rama I)
await page.evaluate(() => window.CI_RENDER(20.0));
await page.screenshot({ path: 'test_frame_20s.jpg', type: 'jpeg', quality: 90 });
console.log('Successfully captured test_frame_20s.jpg!');

await browser.close();
server.close();
