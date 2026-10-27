// Verifica in app reale (preview + utente QA) degli angoli della scheda compressa.
// Il bug: con la scheda compressa gli angoli in basso a sinistra/destra erano
// "retti" invece che smussati (l'header opaco copriva il raggio della card).
// Controllo oggettivo: nel punto esatto dell'angolo della card deve esserci
// il colore del PAGE (#000), non il grigio dell'header (#222).
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const BASE = 'http://127.0.0.1:4173/';
const OUT = 'C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App Kuma CiccioBart/kuma_PL/.workbuddy-ai/tests';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name} ${extra}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on('dialog', (dialog) => dialog.accept());

await page.goto(BASE);
await page.waitForTimeout(1500);

// Login
await page.fill('input[type="text"]', 'qa_switch_test');
await page.fill('input[type="password"]', 'QaTest1234');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

await page.click('text=Programmazioni');
await page.waitForTimeout(2000);

// La scheda parte compressa: niente .program-card-body
const cardInfo = await page.evaluate(() => {
  const card = document.querySelector('.program-card');
  if (!card) return null;
  const r = card.getBoundingClientRect();
  const header = card.querySelector('.program-card-header');
  const hs = getComputedStyle(header);
  const cs = getComputedStyle(card);
  return {
    expanded: card.classList.contains('expanded'),
    hasBody: Boolean(card.querySelector('.program-card-body')),
    headerRadius: hs.borderRadius,
    cardRadius: cs.borderRadius,
    box: { x: r.x, y: r.y, width: r.width, height: r.height },
  };
});
console.log('  card:', JSON.stringify(cardInfo));
check('scheda compressa', cardInfo && !cardInfo.expanded && !cardInfo.hasBody);
check('header con raggio su tutti gli angoli',
  cardInfo && cardInfo.headerRadius === '9px', cardInfo?.headerRadius);

// Campionamento dei pixel sull'angolo della card (dal PNG, via canvas in-page)
const corners = await page.evaluate(async () => {
  const card = document.querySelector('.program-card');
  const r = card.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
const buf = await page.screenshot({ clip: corners });
const px = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const at = (x, y) => {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  };
  return {
    w: c.width,
    h: c.height,
    bl: at(2, c.height - 3),
    br: at(c.width - 3, c.height - 3),
    mid: at(Math.round(c.width / 2), c.height - 3),
    topMid: at(Math.round(c.width / 2), 2),
  };
}, buf.toString('base64'));
console.log('  pixel:', JSON.stringify(px));

// Nell'angolo deve esserci il page (#000), non il grigio dell'header (#222).
const isPage = (p) => p.r < 25 && p.g < 25 && p.b < 25;
const isHeader = (p) => Math.abs(p.r - 34) < 6 && Math.abs(p.g - 34) < 6 && Math.abs(p.b - 34) < 6;

check('angolo basso-sinistra smussato (page, non header grigio)',
  isPage(px.bl) && !isHeader(px.bl), JSON.stringify(px.bl));
check('angolo basso-destra smussato (page, non header grigio)',
  isPage(px.br) && !isHeader(px.br), JSON.stringify(px.br));
check('bordo inferiore al centro pieno (header grigio)',
  isHeader(px.mid), JSON.stringify(px.mid));
check('bordo superiore al centro pieno (header grigio)',
  isHeader(px.topMid), JSON.stringify(px.topMid));

await page.screenshot({ path: `${OUT}/card-real-390.png`, fullPage: false });
await page.close();
await browser.close();
console.log(`\n# pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
