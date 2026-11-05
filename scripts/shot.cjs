// 사용법: node scripts/shot.cjs <url> <out.png> [스텝 JSON]
// 스텝: [{"click":[x,y]}, {"wait":ms}, ...]  좌표는 게임 해상도(1280x720) 기준.
const { chromium } = require('playwright');
(async () => {
  const [url, out, stepsJson] = process.argv.slice(2);
  const steps = stepsJson ? JSON.parse(stepsJson) : [{ wait: 1000 }];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);
  for (const s of steps) {
    if (s.click) await page.mouse.click(s.click[0], s.click[1]);
    if (s.move) await page.mouse.move(s.move[0], s.move[1]);
    if (s.wait) await page.waitForTimeout(s.wait);
  }
  await page.screenshot({ path: out });
  if (errors.length) console.log('ERRORS:', errors.join('\n'));
  await browser.close();
})();
