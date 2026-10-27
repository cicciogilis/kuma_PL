// Round-trip di salvataggio: modifica nome giorno e complementare, salva,
// ricarica e verifica che le modifiche siano persistite.
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const BASE = 'http://127.0.0.1:4173/';
let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name} ${extra}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
page.on('dialog', (dialog) => dialog.accept());

const login = async () => {
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  await page.fill('input[type="text"]', 'qa_switch_test');
  await page.fill('input[type="password"]', 'QaTest1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  await page.click('text=Programmazioni');
  await page.waitForTimeout(1800);
  await page.click('.program-card-header');
  await page.waitForTimeout(600);
};

const openAccessories = async () => {
  if (!(await page.locator('.program-accessories-content').count())) {
    await page.click('.program-accessories .program-week-toggle');
    await page.waitForTimeout(400);
  }
  if (!(await page.locator('.program-accessory-list').count())) {
    await page.click('.program-accessory-day-toggle');
    await page.waitForTimeout(400);
  }
};

await login();
await page.click('.program-card-header .program-edit-btn');
await page.waitForTimeout(600);
await openAccessories();

// rinomina il giorno
await page.click('.program-accessory-day-toggle .program-edit-btn');
await page.waitForTimeout(400);
await page.fill('.program-modal input[type="text"]', 'Upper B');
await page.click('.program-modal button[type="submit"]');
await page.waitForTimeout(400);

// rinomina il primo complementare
await page.click('.program-accessory-list .program-lift .program-edit-btn');
await page.waitForTimeout(400);
await page.fill('.program-accessory-list .program-accessory-add-card input[type="text"]', 'Leg curl seduto');
await page.click('.program-accessory-list .program-accessory-add-card button[type="submit"]');
await page.waitForTimeout(400);

await page.click('.program-note-edit-bar .program-btn-primary');
await page.waitForTimeout(2500);

// ricarica da zero e rileggi
await login();
await openAccessories();

const persisted = await page.evaluate(() => ({
  dayTitle: document.querySelector('.program-accessory-day-title')?.textContent.trim(),
  exercises: [...document.querySelectorAll('.program-accessory-list .program-lift-name')]
    .map((n) => n.textContent.trim()),
}));

check('nome del giorno salvato', persisted.dayTitle === 'Upper B', persisted.dayTitle);
check('nome del complementare salvato', persisted.exercises[0] === 'Leg curl seduto',
  JSON.stringify(persisted.exercises));
check('secondo complementare intatto', persisted.exercises[1] === 'Lat machine',
  JSON.stringify(persisted.exercises));

await page.close();
await browser.close();
console.log(`\n# pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
