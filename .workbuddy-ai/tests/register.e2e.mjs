// Verifica che la registrazione usi ancora UNA sola griglia con 8 campi.
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const BASE = 'http://localhost:4173/';
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

for (const width of [390, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.removeItem('username');
    localStorage.removeItem('password');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3200);

  // Login intatto
  check(`${width}px: titolo Login`, (await page.locator('.login-page h2').textContent()) === 'Login');
  check(
    `${width}px: pulsante Accedi`,
    (await page.locator('.login-button').textContent()) === 'Accedi'
  );

  await page.locator('.toggle-register').click();
  await page.waitForTimeout(500);

  check(
    `${width}px: titolo Registrazione`,
    (await page.locator('.login-page h2').textContent()) === 'Registrazione'
  );

  const grids = await page.locator('.login-page .personal-info-grid').count();
  check(`${width}px: una sola griglia`, grids === 1, `trovate ${grids}`);

  const grid = page.locator('.login-page .personal-info-grid');
  const fields = await grid.locator('input, select').count();
  check(`${width}px: 8 campi (6 anagrafici + username + password)`, fields === 8, String(fields));

  const labels = await grid.locator('.info-label').allTextContents();
  check(
    `${width}px: ordine etichette invariato`,
    JSON.stringify(labels) ===
      JSON.stringify([
        'Nome',
        'Cognome',
        'Data di Nascita',
        'Genere',
        'Città di Nascita',
        'Provincia',
        'Username',
        'Password',
      ]),
    JSON.stringify(labels)
  );

  // Esclude il pulsante interno del PasswordInput (occhio mostra/nascondi, testo vuoto)
  const buttons = (await page.locator('.login-page button').allTextContents())
    .map((b) => b.trim())
    .filter(Boolean);
  check(
    `${width}px: pulsanti Registrati + link Accedi`,
    JSON.stringify(buttons.map((b) => b.trim())) ===
      JSON.stringify(['Registrati', 'Hai già un account? Accedi']),
    JSON.stringify(buttons)
  );

  // le credenziali restano su una riga propria, distaccate
  const geom = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.login-page .personal-info-grid .info-item')];
    const rect = (el) => el.getBoundingClientRect();
    const prov = items.find((el) => el.querySelector('.info-label')?.textContent === 'Provincia');
    const user = items.find((el) => el.querySelector('.info-label')?.textContent === 'Username');
    const pass = items.find((el) => el.querySelector('.info-label')?.textContent === 'Password');
    return {
      provBottom: Math.round(rect(prov).bottom),
      userTop: Math.round(rect(user).top),
      userLeft: Math.round(rect(user).left),
      passLeft: Math.round(rect(pass).left),
      userTop2: Math.round(rect(pass).top),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  check(`${width}px: username su nuova riga sotto provincia`, geom.userTop >= geom.provBottom, JSON.stringify(geom));
  check(`${width}px: username e password affiancati`, geom.userTop2 === geom.userTop, JSON.stringify(geom));
  check(`${width}px: nessun overflow`, geom.overflow <= 0, JSON.stringify(geom));

  await page.screenshot({ path: `.workbuddy-ai/tests/register-${width}.png`, fullPage: true });
  await context.close();
}

await browser.close();
console.log(`\n=== ${pass} PASS / ${failures.length} FAIL ===`);
if (failures.length) process.exitCode = 1;
