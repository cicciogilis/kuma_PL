// Verifica degli angoli della scheda: compressa vs espansa.
// Il bug: con la scheda compressa gli angoli in basso a sinistra/destra sono
// "retti" invece che smussati, perché il raggio del bordo della card (10px)
// viene coperto dai figli senza `overflow: hidden`.
// Controllo oggettivo: si campiona il pixel del canvas esattamente sull'angolo
// della card e si verifica che il colore sia quello del PAGE (magenta),
// non quello del riquadro interno (grigio #222).
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const FIXTURE = 'file:///C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App Kuma CiccioBart/kuma_PL/.workbuddy-ai/tests/cardCorners.fixture.html';
const OUT = 'C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App Kuma CiccioBart/kuma_PL/.workbuddy-ai/tests';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name} ${extra}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
await page.goto(FIXTURE);
await page.waitForTimeout(600);

const probe = async (id) => page.evaluate((cardId) => {
  const card = document.getElementById(cardId);
  const r = card.getBoundingClientRect();
  const header = card.querySelector('.program-card-header');
  const hr = header.getBoundingClientRect();
  const cs = getComputedStyle(card);
  const hs = getComputedStyle(header);
  return {
    card: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    header: { x: Math.round(hr.x), y: Math.round(hr.y), w: Math.round(hr.width), h: Math.round(hr.height) },
    cardRadius: cs.borderRadius,
    cardOverflow: cs.overflow,
    headerRadius: hs.borderRadius,
    // Angoli "duri": 4px dentro l'angolo della card, in basso
    probePoints: {
      bl: { x: Math.round(r.x) + 2, y: Math.round(r.y + r.height) - 2 },
      br: { x: Math.round(r.x + r.width) - 3, y: Math.round(r.y + r.height) - 2 },
    },
  };
}, id);

// Il campionamento pixel avviene nel browser via canvas non è possibile
// (il DOM non è disegnabile). Si usa invece il colore del punto tramite
// screenshot + lettura PNG con Playwright: più semplice, si ritaglia l'angolo
// e si controlla il colore del pixel con sharp-less decoding via canvas.
const samplePixels = async (id) => {
  const box = await page.evaluate((cardId) => {
    const card = document.getElementById(cardId);
    const r = card.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, id);
  // Screenshot dell'area dell'angolo, poi decode PNG in-page per i pixel
  const buf = await page.screenshot({ clip: box });
  return { box, b64: buf.toString('base64') };
};

const compressa = await probe('card-compressa');
const espansa = await probe('card-espansa');

console.log('  compressa:', JSON.stringify(compressa));
console.log('  espansa  :', JSON.stringify(espansa));

// Decode del PNG in-page per campionare i pixel reali degli angoli
const readCorners = async (id) => page.evaluate(async (cardId) => {
  const card = document.getElementById(cardId);
  const r = card.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, id);

const decodeCorners = async (id) => {
  const { b64 } = await samplePixels(id);
  const geom = await readCorners(id);
  return page.evaluate(async ({ b64, geom }) => {
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
      return { r: d[0], g: d[1], b: d[2], a: d[3] };
    };
    // Angolo basso-sinistra della card: 2px dentro
    const bl = at(2, c.height - 3);
    // Angolo basso-destra: 2px dentro da destra
    const br = at(c.width - 3, c.height - 3);
    // Riferimento: pixel al centro del bordo superiore sinistro (deve essere grigio)
    const ref = at(Math.round(c.width / 2), 2);
    return { w: c.width, h: c.height, bl, br, ref };
  }, { b64, geom });
};

const corners = await decodeCorners('card-compressa');
const cornersExpanded = await decodeCorners('card-espansa');
console.log('  pixel compressa:', JSON.stringify(corners));
console.log('  pixel espansa  :', JSON.stringify(cornersExpanded));

// Il magenta del page è (255, 0, 255). Se l'angolo è smussato, il pixel
// sull'angolo è magenta (si vede il page attraverso il raggio).
const isPage = (p) => p.r > 200 && p.g < 60 && p.b > 200;

check('compressa: angolo basso-sinistra smussato (si vede il page)', isPage(corners.bl), JSON.stringify(corners.bl));
check('compressa: angolo basso-destra smussato (si vede il page)', isPage(corners.br), JSON.stringify(corners.br));
check('compressa: il bordo superiore resta pieno (grigio)', !isPage(corners.ref), JSON.stringify(corners.ref));

await page.screenshot({ path: `${OUT}/card-corners-390.png`, fullPage: true });
await page.close();
await browser.close();
console.log(`\n# pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
