// La scheda ESPANSA non deve cambiare: il corpo trasparente fa vedere il
// fondo arrotondato della card, quindi gli angoli inferiori restano smussati
// e l'header mantiene i suoi angoli superiori arrotondati e inferiori retti.
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
await page.fill('input[type="text"]', 'qa_switch_test');
await page.fill('input[type="password"]', 'QaTest1234');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
await page.click('text=Programmazioni');
await page.waitForTimeout(2000);

// Espandi la scheda
await page.click('.program-card-header');
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const card = document.querySelector('.program-card');
  const header = card.querySelector('.program-card-header');
  const r = card.getBoundingClientRect();
  return {
    expanded: card.classList.contains('expanded'),
    hasBody: Boolean(card.querySelector('.program-card-body')),
    headerRadius: getComputedStyle(header).borderRadius,
    box: { x: r.x, y: r.y, width: r.width, height: r.height },
  };
});
console.log('  card espansa:', JSON.stringify(info));

check('scheda espansa', info.expanded && info.hasBody);
check('header espanso: angoli superiori arrotondati, inferiori retti',
  info.headerRadius === '9px 9px 0px 0px', info.headerRadius);

// La card espansa è più alta del viewport: per campionare il BORDO INFERIORE
// reale serve uno screenshot fullPage (con clip relativo alla pagina).
const buf = await page.screenshot({ fullPage: true, clip: info.box });
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
    h: c.height,
    bl: at(2, c.height - 3),
    br: at(c.width - 3, c.height - 3),
    mid: at(Math.round(c.width / 2), c.height - 3),
  };
}, buf.toString('base64'));
console.log('  pixel:', JSON.stringify(px));

const isPage = (p) => p.r < 25 && p.g < 25 && p.b < 25;
const isCard = (p) => Math.abs(p.r - 26) < 8 && Math.abs(p.g - 26) < 8 && Math.abs(p.b - 26) < 8;

check('espansa: angolo basso-sinistra smussato', isPage(px.bl), JSON.stringify(px.bl));
check('espansa: angolo basso-destra smussato', isPage(px.br), JSON.stringify(px.br));
check('espansa: bordo inferiore al centro pieno (fondo card #1a1a1a)', isCard(px.mid), JSON.stringify(px.mid));
await page.screenshot({ path: `${OUT}/card-expanded-390.png`, fullPage: false });
await page.close();
await browser.close();
console.log(`\n# pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
