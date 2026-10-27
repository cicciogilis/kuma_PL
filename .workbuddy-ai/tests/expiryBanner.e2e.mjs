// Verifica il banner di scadenza nella card Programmazioni (CSS reale).
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const FIXTURE = 'file:///C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App%20Kuma%20CiccioBart/kuma_PL/.workbuddy-ai/tests/expiryBanner.fixture.html';

const browser = await chromium.launch();
let pass = 0;
const failures = [];
const check = (label, cond, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

for (const width of [320, 360, 390, 430, 480, 1280]) {
  console.log(`\n=== ${width}px ===`);
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(FIXTURE, { waitUntil: 'load' });
  await page.waitForTimeout(200);

  const data = await page.evaluate(() => {
    const measure = (cardId) => {
      const card = document.getElementById(cardId);
      const header = card.querySelector('.program-card-header');
      const banner = card.querySelector('.program-expiry-action');
      const icons = [...card.querySelectorAll('.program-edit-btn, .program-delete-btn, .program-card-chevron')];
      if (!banner) return null;
      const cs = getComputedStyle(header);
      const pad = parseFloat(cs.paddingLeft);
      const hb = header.getBoundingClientRect();
      const bb = banner.getBoundingClientRect();
      const label = banner.querySelector('span');
      return {
        headerInnerLeft: Math.round(hb.left + pad),
        headerInnerRight: Math.round(hb.right - pad),
        bannerLeft: Math.round(bb.left),
        bannerRight: Math.round(bb.right),
        bannerTop: Math.round(bb.top),
        bannerBottom: Math.round(bb.bottom),
        iconsTop: Math.round(Math.min(...icons.map((el) => el.getBoundingClientRect().top))),
        iconsRight: Math.round(Math.max(...icons.map((el) => el.getBoundingClientRect().right))),
        // testo tagliato?
        textClipped: label.scrollWidth > label.clientWidth + 1,
        textHeight: Math.round(label.getBoundingClientRect().height),
        whiteSpace: getComputedStyle(banner).whiteSpace,
        overflow: getComputedStyle(banner).overflow,
      };
    };
    return {
      pending: measure('card-pending'),
      sent: measure('card-sent'),
      plainIcons: [...document.querySelectorAll('#card-plain .program-card-header > *')].map((el) => el.className),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  for (const state of ['pending', 'sent']) {
    const d = data[state];
    check(`${state}: banner presente`, Boolean(d), '');
    if (!d) continue;
    check(
      `${state}: banner a tutta larghezza della card`,
      width > 480
        ? d.bannerRight < d.iconsRight
        : Math.abs(d.bannerLeft - d.headerInnerLeft) <= 1
          && Math.abs(d.bannerRight - d.headerInnerRight) <= 1,
      JSON.stringify(d)
    );
    check(`${state}: testo non tagliato`, d.textClipped === false, JSON.stringify(d));
    if (width <= 480) {
      check(
        `${state}: banner sopra le icone, senza sovrapposizione`,
        d.bannerBottom <= d.iconsTop + 1,
        JSON.stringify({ bannerBottom: d.bannerBottom, iconsTop: d.iconsTop })
      );
      check(`${state}: nessun nowrap forzato`, d.whiteSpace === 'normal', d.whiteSpace);
    }
  }

  check('nessun overflow orizzontale', data.overflowX <= 0, String(data.overflowX));
  check('card senza banner resta intatta (3 icone in riga)', data.plainIcons.length === 4, JSON.stringify(data.plainIcons));

  await page.screenshot({ path: `.workbuddy-ai/tests/expiry-banner-${width}.png`, fullPage: true });
  await context.close();
}

await browser.close();
console.log(`\n=== ${pass} PASS / ${failures.length} FAIL ===`);
if (failures.length) {
  for (const f of failures) console.log('  -', f);
  process.exitCode = 1;
}
