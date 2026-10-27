import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const USER = 'qa_switch_test';
const PASS = 'QaTest1234';

const widths = [320, 360, 390, 430, 600, 768, 1280];

const browser = await chromium.launch();
const report = [];

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(([u, p]) => {
    localStorage.setItem('username', u);
    localStorage.setItem('password', p);
  }, [USER, PASS]);
  await page.reload({ waitUntil: 'load' });

  // splash 2s + auto login
  await page.waitForTimeout(4500);

  // naviga in Settings
  const settingsBtn = page.locator('.menu-bar button[aria-label="Settings"]');
  if (await settingsBtn.count()) {
    await settingsBtn.click();
    await page.waitForTimeout(900);
  }

  const row = page.locator('.leaderboard-toggle-row');
  const exists = (await row.count()) > 0;

  let data = { width, exists };
  if (exists) {
    const geom = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
      };
      const lines = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        return Math.round(el.getBoundingClientRect().height / lh);
      };
      const row = q('.leaderboard-toggle-row');
      const sw = q('.leaderboard-toggle-row .toggle-switch');
      const slider = q('.leaderboard-toggle-row .toggle-slider');
      const text = q('.leaderboard-toggle-row .leaderboard-toggle-text');
      const title = q('.leaderboard-toggle-title');
      const hint = q('.leaderboard-toggle-hint');
      const section = q('.leaderboard-toggle-row').closest('.profile-section');
      const rowB = box(row);
      const swB = box(sw);
      const sliderB = box(slider);
      const sectionB = box(section);
      return {
        row: rowB,
        section: sectionB,
        switch: swB,
        slider: sliderB,
        text: box(text),
        title: box(title),
        hint: box(hint),
        titleLines: lines(title),
        hintLines: lines(hint),
        switchOffsetFromRowLeft: +(swB.x - rowB.x).toFixed(1),
        switchOffsetFromSectionLeft: +(swB.x - sectionB.x).toFixed(1),
        switchCenterY: +(swB.y + swB.h / 2).toFixed(1),
        rowCenterY: +(rowB.y + rowB.h / 2).toFixed(1),
        docScrollW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
      };
    });
    data = { ...data, ...geom };
  }

  const shot = `.workbuddy-ai/tests/settings-${width}.png`;
  await page.screenshot({ path: shot, fullPage: false });
  data.shot = shot;

  report.push(data);
  await context.close();
}

await browser.close();

for (const r of report) {
  console.log(JSON.stringify(r));
}
