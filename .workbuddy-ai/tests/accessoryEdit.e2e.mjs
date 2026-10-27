// Verifica in app reale (preview + utente QA) dei fix dei complementari:
// larghezza del riquadro giorno vs header "Complementari", matita/cestino,
// banner giallo, e modifica/eliminazione di giorno e complementare.
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const BASE = 'http://127.0.0.1:4173/';
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

// Apri la scheda
await page.click('.program-card-header');
await page.waitForTimeout(600);

// Entra in modifica con la matita della scheda
await page.click('.program-card-header .program-edit-btn');
await page.waitForTimeout(600);

const banner = await page.evaluate(() => {
  const bar = document.querySelector('.program-note-edit-bar');
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  const buttons = [...bar.querySelectorAll('button')].map((b) => {
    const br = b.getBoundingClientRect();
    return { w: Math.round(br.width), overflow: b.scrollWidth > b.clientWidth + 1 };
  });
  return { w: Math.round(r.width), buttons, hasTitle: Boolean(bar.querySelector('.program-note-edit-title')) };
});

check('banner giallo senza il testo rimosso', banner && banner.hasTitle === false);
check('banner giallo: due pulsanti', banner && banner.buttons.length === 2);
check('pulsanti riempiono il banner', banner
  && Math.abs(banner.buttons[0].w + banner.buttons[1].w + 8 - (banner.w - 26)) <= 2,
  JSON.stringify(banner));
check('nessun pulsante tronca il testo', banner && banner.buttons.every((b) => !b.overflow));

// Apri la sezione Complementari (già aperta in modifica)
const accOpen = await page.locator('.program-accessories-content').count();
if (!accOpen) {
  await page.click('.program-accessories .program-week-toggle');
  await page.waitForTimeout(400);
}

const widths = await page.evaluate(() => {
  const header = document.querySelector('.program-accessories > .program-week-toggle');
  const day = document.querySelector('.program-accessory-day');
  const dayToggle = document.querySelector('.program-accessory-day-toggle');
  const card = document.querySelector('.program-card-body');
  const r = (el) => el && el.getBoundingClientRect();
  const cs = day && getComputedStyle(day);
  return {
    header: header ? { w: Math.round(r(header).width), x: Math.round(r(header).x), right: Math.round(r(header).right) } : null,
    day: day ? { w: Math.round(r(day).width), x: Math.round(r(day).x), right: Math.round(r(day).right) } : null,
    toggle: dayToggle ? { w: Math.round(r(dayToggle).width), right: Math.round(r(dayToggle).right) } : null,
    card: card ? { w: Math.round(r(card).width), x: Math.round(r(card).x) } : null,
    borderLeft: cs ? cs.borderLeftWidth : null,
    paddingLeft: cs ? cs.paddingLeft : null,
    hasPencil: Boolean(document.querySelector('.program-accessory-day-toggle .program-edit-btn')),
    hasTrash: Boolean(document.querySelector('.program-accessory-day-toggle .program-delete-btn')),
  };
});
console.log('  misure:', JSON.stringify(widths));

check('nessuna riga grigia sul giorno', widths.borderLeft === '0px' && widths.paddingLeft === '0px',
  `${widths.borderLeft} / ${widths.paddingLeft}`);
check('giorno largo quanto l\'header Complementari',
  widths.day && widths.header && Math.abs(widths.day.w - widths.header.w) <= 1,
  JSON.stringify({ day: widths.day, header: widths.header }));
check('giorno allineato a sinistra con l\'header',
  widths.day && widths.header && Math.abs(widths.day.x - widths.header.x) <= 1);
check('giorno allineato a destra con l\'header',
  widths.day && widths.header && Math.abs(widths.day.right - widths.header.right) <= 1);
check('matita e cestino presenti sul giorno', widths.hasPencil && widths.hasTrash);

// Matita del giorno: apre il modale precompilato
await page.click('.program-accessory-day-toggle .program-edit-btn');
await page.waitForTimeout(400);
const modal = await page.evaluate(() => {
  const dialog = document.querySelector('.program-modal');
  if (!dialog) return null;
  const inputs = [...dialog.querySelectorAll('input, select')];
  return {
    title: dialog.querySelector('.program-modal-title')?.textContent.trim(),
    values: inputs.map((i) => i.value),
    submit: dialog.querySelector('button[type="submit"]')?.textContent.trim(),
  };
});
check('modale si apre in modifica', modal && modal.title === 'Modifica giorno complementari', modal?.title);
check('nome precompilato', modal && modal.values[0] === 'Upper', modal?.values[0]);
check('giorno settimana precompilato', modal && modal.values[1] === 'Lunedì', modal?.values[1]);
check('pulsante di conferma corretto', modal && modal.submit === 'Salva giorno', modal?.submit);

// Modifica il nome e salva
await page.fill('.program-modal input[type="text"]', 'Upper B');
await page.click('.program-modal button[type="submit"]');
await page.waitForTimeout(500);
const renamed = await page.evaluate(() =>
  document.querySelector('.program-accessory-day-title')?.textContent.trim());
check('nome del giorno aggiornato', renamed === 'Upper B', renamed);

// Apri il giorno complementari
if (!(await page.locator('.program-accessory-list').count())) {
  await page.click('.program-accessory-day-toggle');
  await page.waitForTimeout(400);
}

// Matita del complementare: form precompilato
const exerciseBefore = await page.evaluate(() => {
  const lift = document.querySelector('.program-accessory-list .program-lift');
  return {
    name: lift?.querySelector('.program-lift-name')?.textContent.trim(),
    hasPencil: Boolean(lift?.querySelector('.program-edit-btn')),
    hasTrash: Boolean(lift?.querySelector('.program-delete-btn')),
    pencilSize: (() => {
      const b = lift?.querySelector('.program-edit-btn');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })(),
  };
});
check('matita e cestino sul complementare', exerciseBefore.hasPencil && exerciseBefore.hasTrash);
check('area di tocco complementare >= 25px',
  exerciseBefore.pencilSize && exerciseBefore.pencilSize.w >= 25 && exerciseBefore.pencilSize.h >= 25,
  JSON.stringify(exerciseBefore.pencilSize));

await page.click('.program-accessory-list .program-lift .program-edit-btn');
await page.waitForTimeout(400);
const editForm = await page.evaluate(() => {
  const form = document.querySelector('.program-accessory-list .program-accessory-add-card');
  if (!form) return null;
  const inputs = [...form.querySelectorAll('input[type="text"]')];
  return {
    values: inputs.map((i) => i.value),
    submit: form.querySelector('button[type="submit"]')?.textContent.trim(),
  };
});
check('form complementare precompilato',
  editForm && editForm.values[0] === 'Leg curl' && editForm.values[1] === '3 + 4' && editForm.values[2] === '8 + 6',
  JSON.stringify(editForm?.values));
check('pulsante "Salva complementare"', editForm && editForm.submit === 'Salva complementare', editForm?.submit);

// Cambia nome e salva
await page.fill('.program-accessory-list .program-accessory-add-card input[type="text"]', 'Leg curl seduto');
await page.click('.program-accessory-list .program-accessory-add-card button[type="submit"]');
await page.waitForTimeout(500);
const exerciseAfter = await page.evaluate(() =>
  [...document.querySelectorAll('.program-accessory-list .program-lift-name')].map((n) => n.textContent.trim()));
check('complementare modificato', exerciseAfter[0] === 'Leg curl seduto', JSON.stringify(exerciseAfter));
check('secondo complementare invariato', exerciseAfter[1] === 'Lat machine', JSON.stringify(exerciseAfter));

// Cestino del complementare
await page.click('.program-accessory-list .program-lift .program-delete-btn');
await page.waitForTimeout(500);
const afterDelete = await page.evaluate(() =>
  [...document.querySelectorAll('.program-accessory-list .program-lift-name')].map((n) => n.textContent.trim()));
check('complementare eliminato', afterDelete.length === 1 && afterDelete[0] === 'Lat machine',
  JSON.stringify(afterDelete));

// La nota del complementare rimasto non deve spostarsi sull'indice sbagliato
const noteAfterDelete = await page.evaluate(() => {
  const area = document.querySelector('.program-accessory-list textarea');
  return area ? area.value : null;
});
check('nota del complementare rimasto conservata', noteAfterDelete === 'nota lat', noteAfterDelete);

// Cestino del giorno
const dayCountBefore = await page.locator('.program-accessory-day').count();
await page.click('.program-accessory-day-toggle .program-delete-btn');
await page.waitForTimeout(500);
const dayCountAfter = await page.locator('.program-accessory-day').count();
check('giorno eliminato', dayCountAfter === dayCountBefore - 1, `${dayCountBefore} -> ${dayCountAfter}`);

// Annulla per non sporcare i dati
await page.click('.program-note-edit-bar .program-btn-secondary');
await page.waitForTimeout(400);

// --- HOME: il riquadro del giorno deve essere largo come quello nella scheda ---
await page.click('button[aria-label="Home"]');
await page.waitForTimeout(1500);
const homeDay = await page.evaluate(() => {
  const el = document.querySelector('.next-workout-card .program-day');
  return el ? Math.round(el.getBoundingClientRect().width) : null;
});
check('Home: riquadro allenamento presente', homeDay !== null, String(homeDay));

await page.click('text=Programmazioni');
await page.waitForTimeout(1500);
if (!(await page.locator('.program-card-body').count())) {
  await page.click('.program-card-header');
  await page.waitForTimeout(500);
}
if (!(await page.locator('.program-week-content').count())) {
  await page.click('.program-week > .program-week-toggle');
  await page.waitForTimeout(500);
}
const programDay = await page.evaluate(() => {
  const el = document.querySelector('.program-week-content .program-day');
  return el ? Math.round(el.getBoundingClientRect().width) : null;
});
check('scheda: riquadro giorno presente', programDay !== null, String(programDay));
check('Home larga come la scheda (scarto <= 8px)',
  homeDay !== null && programDay !== null && Math.abs(programDay - homeDay) <= 8,
  `home=${homeDay} scheda=${programDay}`);

await page.screenshot({ path: '.workbuddy-ai/tests/accessory-390.png', fullPage: false });
await page.close();
await browser.close();
console.log(`\n# pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
