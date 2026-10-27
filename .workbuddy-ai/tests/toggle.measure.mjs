import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, 'toggle.fixture.html');
const url = 'file:///' + fixturePath.replace(/\\/g, '/');

const VIEWPORTS = [
  { width: 320, height: 700, name: 'iPhone SE' },
  { width: 360, height: 780, name: 'Android small' },
  { width: 375, height: 812, name: 'iPhone X' },
  { width: 390, height: 844, name: 'iPhone 14' },
  { width: 430, height: 844, name: 'iPhone Pro Max' },
  { width: 600, height: 800, name: 'breakpoint 600' },
  { width: 768, height: 800, name: 'tablet' },
  { width: 1280, height: 800, name: 'desktop' },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(url);
  await page.waitForTimeout(120);

  const m = await page.evaluate(() => {
    const row = document.getElementById('toggle-row');
    const sw = document.getElementById('toggle-switch');
    const text = document.getElementById('toggle-text');
    const title = document.querySelector('.leaderboard-toggle-title');
    const hint = document.querySelector('.leaderboard-toggle-hint');

    const r = row.getBoundingClientRect();
    const s = sw.getBoundingClientRect();
    const t = text.getBoundingClientRect();

    // how many lines does each text render on?
    const lineCount = (el) => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight);
      return Math.round(el.getBoundingClientRect().height / lh);
    };

    return {
      rowLeft: Math.round(r.left),
      rowRight: Math.round(r.right),
      rowWidth: Math.round(r.width),
      swLeft: Math.round(s.left),
      swRight: Math.round(s.right),
      swWidth: Math.round(s.width),
      offsetFromLeft: Math.round(s.left - r.left),
      offsetFromRight: Math.round(r.right - s.right),
      textLeft: Math.round(t.left),
      textWidth: Math.round(t.width),
      titleLines: lineCount(title),
      hintLines: lineCount(hint),
      titleHeight: Math.round(title.getBoundingClientRect().height),
      hintHeight: Math.round(hint.getBoundingClientRect().height),
      hintText: hint.textContent.trim(),
    };
  });

  console.log(`\n=== ${vp.name} (${vp.width}px) ===`);
  console.log(`row: left=${m.rowLeft} right=${m.rowRight} w=${m.rowWidth}`);
  console.log(`switch: left=${m.swLeft} right=${m.swRight} w=${m.swWidth}`);
  console.log(`  offset from row-left = ${m.offsetFromLeft}px | from row-right = ${m.offsetFromRight}px`);
  console.log(`text: left=${m.textLeft} w=${m.textWidth}`);
  console.log(`title lines=${m.titleLines} (h=${m.titleHeight})  hint lines=${m.hintLines} (h=${m.hintHeight})`);

  await page.screenshot({ path: join(__dirname, `toggle-${vp.width}.png`) });
}

await browser.close();
