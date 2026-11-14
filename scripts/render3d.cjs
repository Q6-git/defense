// 3D 모델(scripts/art3d/models.ts)을 PNG로 렌더링해 public/sprites/ 에 저장한다.
// 사용법: npx vite --port 5199 & 띄운 뒤  node scripts/render3d.cjs [--out=폴더]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? path.join(__dirname, '../public/sprites');
  const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5199/scripts/art3d/render.html';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => 'renderAll' in window, null, { timeout: 30000 });
  const imgs = await page.evaluate(() => window.renderAll());
  for (const [name, data] of Object.entries(imgs)) {
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log('저장', name);
  }
  if (errors.length) console.log('ERRORS:', errors.join('\n'));
  await browser.close();
})();
