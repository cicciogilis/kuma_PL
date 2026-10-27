// Verifica grafica dei complementari (fixture con i CSS reali):
// 1) il riquadro del giorno occupa la stessa larghezza dell'header "Complementari"
//    e non ha più la riga grigia a sinistra
// 2) matita e cestino del giorno e del singolo complementare, con area di tocco mobile
// 3) i pulsanti del banner giallo riempiono la larghezza
// 4) il testo dell'allegato va a capo dopo "(max 5 MB)"
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const url = 'file:///C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App%20Kuma%20CiccioBart/kuma_PL/.workbuddy-ai/tests/accessoryLayout.fixture.html';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name} ${extra}`); }
};

const browser = await chromium.launch();

for (const width of [1280, 768, 390, 320]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(120);
  console.log(`\n=== ${width}px ===`);

  const data = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right };
    };
    const style = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    const dayStyle = getComputedStyle(document.querySelector('#giorno'));
    return {
      header: rect('#header-complementari'),
      day: rect('#giorno'),
      dayHead: rect('#giorno-head'),
      dayToggle: rect('#giorno-head'),
      matitaGiorno: rect('#matita-giorno'),
      cestinoGiorno: rect('#cestino-giorno'),
      matitaEsercizio: rect('#matita-esercizio'),
      cestinoEsercizio: rect('#cestino-esercizio'),
      banner: rect('#banner-giallo'),
      annulla: rect('#btn-annulla'),
      salva: rect('#btn-salva'),
      form: rect('#form-modifica'),
      dayBorderLeft: dayStyle.borderLeftWidth,
      dayPaddingLeft: dayStyle.paddingLeft,
      formBorderLeft: style('#form-modifica', 'borderLeftWidth'),
      hintRect: rect('#hint'),
      // seconda riga del testo: dove inizia davvero "I complementari"
      hintSecondLineTop: (() => {
        const p = document.querySelector('#hint');
        const range = document.createRange();
        const textNode = [...p.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes('I complementari'));
        if (!textNode) return null;
        const start = textNode.textContent.indexOf('I complementari');
        range.setStart(textNode, start);
        range.setEnd(textNode, start + 5);
        const r = range.getBoundingClientRect();
        return { top: r.top, left: r.left };
      })(),
      salvaOverflow: (() => {
        const el = document.querySelector('#btn-salva');
        return el.scrollWidth > el.clientWidth + 1;
      })(),
    };
  });

  // 1) larghezza: il giorno non è più rientrato rispetto all'header
  check('giorno largo quanto header Complementari',
    Math.abs(data.day.w - data.header.w) < 1,
    `giorno=${data.day.w.toFixed(1)} header=${data.header.w.toFixed(1)}`);
  check('giorno parte dallo stesso bordo sinistro',
    Math.abs(data.day.x - data.header.x) < 1,
    `giorno=${data.day.x.toFixed(1)} header=${data.header.x.toFixed(1)}`);
  check('nessuna riga grigia a sinistra',
    data.dayBorderLeft === '0px' && data.dayPaddingLeft === '0px',
    `border=${data.dayBorderLeft} padding=${data.dayPaddingLeft}`);

  // 2) matita e cestino
  check('matita giorno presente e dentro la riga',
    data.matitaGiorno && data.matitaGiorno.right <= data.dayHead.right + 1,
    JSON.stringify(data.matitaGiorno));
  check('cestino giorno a sinistra della chevron',
    data.cestinoGiorno && data.cestinoGiorno.right <= data.dayHead.right + 1);
  check('matita e cestino giorno non sovrapposti',
    data.matitaGiorno.right <= data.cestinoGiorno.x + 1,
    `${data.matitaGiorno.right.toFixed(1)} vs ${data.cestinoGiorno.x.toFixed(1)}`);
  check('area di tocco giorno >= 27px',
    data.matitaGiorno.w >= 27 && data.matitaGiorno.h >= 27,
    `${data.matitaGiorno.w.toFixed(1)}x${data.matitaGiorno.h.toFixed(1)}`);
  check('matita esercizio >= 25px',
    data.matitaEsercizio.w >= 25 && data.matitaEsercizio.h >= 25,
    `${data.matitaEsercizio.w.toFixed(1)}x${data.matitaEsercizio.h.toFixed(1)}`);
  check('cestino esercizio >= 25px',
    data.cestinoEsercizio.w >= 25 && data.cestinoEsercizio.h >= 25,
    `${data.cestinoEsercizio.w.toFixed(1)}x${data.cestinoEsercizio.h.toFixed(1)}`);

  // 3) banner giallo: i due pulsanti riempiono lo spazio (12px padding + 1px bordo per lato)
  const bannerInner = data.banner.w - 24 - 2;
  const somma = data.annulla.w + data.salva.w + 8;
  check('pulsanti riempiono il banner giallo', Math.abs(somma - bannerInner) < 2,
    `pulsanti=${somma.toFixed(1)} disponibile=${bannerInner.toFixed(1)}`);
  check('pulsanti uguali tra loro', Math.abs(data.annulla.w - data.salva.w) < 1,
    `${data.annulla.w.toFixed(1)} vs ${data.salva.w.toFixed(1)}`);
  check('"Salva le modifiche" non tronca il testo', data.salvaOverflow === false);

  // 4) andata a capo dopo "(max 5 MB)"
  check('seconda riga inizia al bordo sinistro',
    data.hintSecondLineTop !== null
      && Math.abs(data.hintSecondLineTop.left - data.hintRect.x) < 2,
    data.hintSecondLineTop
      ? `left=${data.hintSecondLineTop.left.toFixed(1)} hint=${data.hintRect.x.toFixed(1)}`
      : 'testo non trovato');
  check('la seconda riga sta sotto la prima',
    data.hintSecondLineTop && data.hintSecondLineTop.top > data.hintRect.y + 8);

  await page.close();
}

await browser.close();
console.log(`\n# pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
