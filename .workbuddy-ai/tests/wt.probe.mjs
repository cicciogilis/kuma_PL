// Baseline: misura gli spazi vuoti nel pannello Strumenti allenamento.
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const browser = await chromium.launch();

for (const width of [390, 320]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.setItem('username', 'qa_switch_test');
    localStorage.setItem('password', 'QaTest1234');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4500);

  await page.locator('.menu-bar button[aria-label="Programmazioni"]').click();
  await page.waitForTimeout(700);
  await page.locator('.wt-fab').click();
  await page.waitForTimeout(900);

  const data = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const head = document.querySelector('.wt-plate-card .wt-card-head');
    const controls = document.querySelector('.wt-plate-controls');
    const card = document.querySelector('.wt-plate-card');
    return {
      card: r('.wt-plate-card'),
      cardInner: card ? Math.round(card.getBoundingClientRect().width - 28) : null,
      head: r('.wt-plate-card .wt-card-head'),
      controls: r('.wt-plate-controls'),
      barPicker: r('.wt-bar-picker'),
      barSelect: r('.wt-bar-picker select'),
      blocks: r('.wt-blocks-toggle'),
      weightRow: r('.wt-weight-input-row'),
      clockBody: r('.wt-clock-body'),
      dial: r('.wt-dial-wrap'),
      clockSide: r('.wt-clock-side'),
      presets: r('.wt-presets'),
      actions: r('.wt-clock-actions'),
      calcShortcuts: r('.wt-calc-shortcuts'),
      calcDisplay: r('.wt-calc-display'),
    };
  });
  console.log(width, JSON.stringify(data));

  await page.screenshot({ path: `.workbuddy-ai/tests/wt-before-${width}.png` });

  // calcolatrice: digita 1 , 5
  await page.locator('.wt-calc-key', { hasText: '1' }).first().click();
  await page.locator('.wt-calc-key[aria-label="Virgola decimale"]').click();
  await page.locator('.wt-calc-key', { hasText: '5' }).first().click();
  await page.waitForTimeout(300);
  const calc = await page.evaluate(() => {
    const v = document.querySelector('.wt-calc-value');
    const cs = getComputedStyle(v);
    const b = v.getBoundingClientRect();
    return {
      text: v.textContent,
      width: Math.round(b.width),
      boxW: Math.round(v.parentElement.getBoundingClientRect().width),
      fontVariant: cs.fontVariantNumeric,
      letterSpacing: cs.letterSpacing,
      fontSize: cs.fontSize,
    };
  });
  console.log(width, 'calc', JSON.stringify(calc));
  await page.locator('.wt-calc-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `.workbuddy-ai/tests/wt-calc-${width}.png` });

  await context.close();
}

await browser.close();
