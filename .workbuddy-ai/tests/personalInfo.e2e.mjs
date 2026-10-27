// E2E: flusso "Informazioni personali" prima dell'ingresso nell'app.
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const DB = 'https://sbd-ladder-default-rtdb.europe-west1.firebasedatabase.app';
const PASSWORD = 'QaTest1234';

const bcrypt = (await import('file:///C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App%20Kuma%20CiccioBart/kuma_PL/node_modules/bcryptjs/index.js')).default;
const hash = bcrypt.hashSync(PASSWORD, 8);

const SEEDS = {
  qa_info_incomplete: {
    username: 'qa_info_incomplete',
    firstName: 'Luca',
    lastName: 'Bianchi',
    birthDate: '1995-03-08',
    birthCity: 'Torino',
    birthProvince: '',
    gender: 'M',
    firstLogin: true,
    showUsernameOnLeaderboard: false,
  },
  qa_info_empty: {
    username: 'qa_info_empty',
    s: 100,
    b: 60,
    d: 140,
    firstLogin: false,
    showUsernameOnLeaderboard: false,
  },
  qa_switch_test: {
    username: 'qa_switch_test',
    firstName: 'Marco',
    lastName: 'Moscheo',
    birthDate: '1990-05-12',
    birthCity: 'Roma',
    birthProvince: 'RM',
    gender: 'M',
    firstLogin: false,
    showUsernameOnLeaderboard: true,
  },
};

const seed = async (key) => {
  const res = await fetch(`${DB}/users/${key}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: hash, ...SEEDS[key] }),
  });
  if (res.status !== 200) throw new Error(`seed ${key} fallito: ${res.status}`);
};

const readUser = async (key) => (await fetch(`${DB}/users/${key}.json`)).json();

let pass = 0;
const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const browser = await chromium.launch();

const login = async (page, user) => {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(([u, p]) => {
    localStorage.setItem('username', u);
    localStorage.setItem('password', p);
  }, [user, PASSWORD]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4500); // splash 2s + login + loadUserData
};

const newPage = async (width = 390) => {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  return { context, page: await context.newPage() };
};

// ---------------------------------------------------------------- TEST A
console.log('\nA) profilo con provincia mancante + configurazione iniziale richiesta');
{
  await seed('qa_info_incomplete');
  const { context, page } = await newPage(390);
  await login(page, 'qa_info_incomplete');

  const title = await page.locator('.login-page h2').textContent().catch(() => null);
  check('titolo è "Informazioni personali"', title === 'Informazioni personali', String(title));

  const grid = page.locator('.personal-info-grid');
  check('griglia dati presente', (await grid.count()) === 1);

  const inputCount = await grid.locator('input, select').count();
  check('esattamente 6 campi', inputCount === 6, `trovati ${inputCount}`);

  const labels = await grid.locator('.info-label').allTextContents();
  check(
    'etichette = Nome, Cognome, Data di Nascita, Genere, Città di Nascita, Provincia',
    JSON.stringify(labels) ===
      JSON.stringify(['Nome', 'Cognome', 'Data di Nascita', 'Genere', 'Città di Nascita', 'Provincia']),
    JSON.stringify(labels)
  );

  check('nessun campo username', (await page.locator('input[aria-label="Username"]').count()) === 0);
  check('nessun campo password', (await page.locator('input[type="password"]').count()) === 0);

  const buttons = await page.locator('.login-page button').allTextContents();
  check('un solo pulsante', buttons.length === 1, JSON.stringify(buttons));
  check('pulsante è "Continua"', buttons[0]?.trim() === 'Continua', String(buttons[0]));
  check(
    'nessun "Registrati" / "Hai già un account"',
    !buttons.some((b) => /Registrati|Hai già un account/i.test(b))
  );

  check('menu di navigazione nascosto', (await page.locator('.menu-bar').count()) === 0);

  const prefill = await page.evaluate(() => {
    const g = document.querySelector('.personal-info-grid');
    const els = [...g.querySelectorAll('input, select')];
    return els.map((el) => el.value);
  });
  check(
    'campi precompilati con i valori esistenti (provincia vuota)',
    JSON.stringify(prefill) === JSON.stringify(['Luca', 'Bianchi', '1995-03-08', 'M', 'Torino', '']),
    JSON.stringify(prefill)
  );

  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth
  );
  check('nessun overflow orizzontale a 390px', noOverflow);

  await page.screenshot({ path: '.workbuddy-ai/tests/personal-info-390.png' });

  // compila la provincia e continua
  await page.locator('.personal-info-grid input[aria-label="Provincia di nascita"]').fill('TO');
  await page.locator('.login-page button', { hasText: 'Continua' }).click();
  await page.waitForTimeout(2500);

  const modal = page.locator('.first-login-modal');
  check('dopo Continua appare il popup di benvenuto/massimali', (await modal.count()) === 1);

  const stored = await readUser('qa_info_incomplete');
  check('provincia salvata', stored.birthProvince === 'TO', String(stored.birthProvince));
  check('firstLogin azzerato', stored.firstLogin === false, String(stored.firstLogin));
  check('nome preservato', stored.firstName === 'Luca', String(stored.firstName));
  check('cognome preservato', stored.lastName === 'Bianchi', String(stored.lastName));
  check('data di nascita preservata', stored.birthDate === '1995-03-08', String(stored.birthDate));
  check('città preservata', stored.birthCity === 'Torino', String(stored.birthCity));
  check('genere preservato', stored.gender === 'M', String(stored.gender));

  await page.screenshot({ path: '.workbuddy-ai/tests/personal-info-after-390.png' });

  // il pulsante del popup porta ai Personal Record
  await page.locator('.first-login-btn').click();
  await page.waitForTimeout(600);
  check(
    'il popup porta a Personal Record',
    (await page.locator('.menu-bar button[aria-current="page"]').getAttribute('aria-label')) ===
      'Personal Record'
  );

  await context.close();
}

// ---------------------------------------------------------------- TEST B
console.log('\nB) profilo storico senza alcun dato anagrafico, firstLogin false');
{
  await seed('qa_info_empty');
  const { context, page } = await newPage(390);
  await login(page, 'qa_info_empty');

  check(
    'mostra "Informazioni personali"',
    (await page.locator('.login-page h2').textContent()) === 'Informazioni personali'
  );

  const prefill = await page.evaluate(() => {
    const g = document.querySelector('.personal-info-grid');
    return [...g.querySelectorAll('input, select')].map((el) => el.value);
  });
  check('tutti i campi vuoti', prefill.every((v) => v === ''), JSON.stringify(prefill));

  // prova a inviare vuoto: deve bloccare con alert
  let dialogMessage = null;
  page.once('dialog', async (d) => {
    dialogMessage = d.message();
    await d.accept();
  });
  await page.locator('.login-page button', { hasText: 'Continua' }).click();
  await page.waitForTimeout(800);
  check('invio incompleto bloccato', dialogMessage === 'Compila tutti i campi', String(dialogMessage));

  const stillThere = await page.locator('.login-page h2').textContent();
  check('resta sulla pagina', stillThere === 'Informazioni personali', String(stillThere));

  // compila tutto
  await page.locator('input[aria-label="Nome"]').fill('Anna');
  await page.locator('input[aria-label="Cognome"]').fill('Verdi');
  await page.locator('input[aria-label="Data di nascita"]').fill('1998-11-02');
  await page.locator('select[aria-label="Genere"]').selectOption('F');
  await page.locator('input[aria-label="Città di nascita"]').fill('Bari');
  await page.locator('input[aria-label="Provincia di nascita"]').fill('BA');
  await page.locator('.login-page button', { hasText: 'Continua' }).click();
  await page.waitForTimeout(2500);

  check(
    'nessun popup di benvenuto (firstLogin era false)',
    (await page.locator('.first-login-modal').count()) === 0
  );
  check(
    'entra nell app sulla Home',
    (await page.locator('.menu-bar button[aria-current="page"]').getAttribute('aria-label')) === 'Home'
  );

  const stored = await readUser('qa_info_empty');
  check('dati salvati (nome)', stored.firstName === 'Anna', String(stored.firstName));
  check('dati salvati (provincia)', stored.birthProvince === 'BA', String(stored.birthProvince));
  check('dati salvati (genere)', stored.gender === 'F', String(stored.gender));
  check('massimali non toccati (s)', stored.s === 100, String(stored.s));
  check('massimali non toccati (d)', stored.d === 140, String(stored.d));

  await context.close();
}

// ---------------------------------------------------------------- TEST C
console.log('\nC) profilo completo: nessuna deviazione');
{
  await seed('qa_switch_test');
  const { context, page } = await newPage(390);
  await login(page, 'qa_switch_test');

  check(
    'non passa da "Informazioni personali"',
    (await page.locator('.login-page').count()) === 0
  );
  check(
    'entra sulla Home',
    (await page.locator('.menu-bar button[aria-current="page"]').getAttribute('aria-label')) === 'Home'
  );
  await context.close();
}

// ---------------------------------------------------------------- TEST D
console.log('\nD) layout della pagina "Informazioni personali" su viewport stretti');
{
  await seed('qa_info_empty');
  for (const width of [320, 360, 390, 430]) {
    const { context, page } = await newPage(width);
    await login(page, 'qa_info_empty');

    const info = await page.evaluate(() => {
      const grid = document.querySelector('.personal-info-grid');
      const rect = grid.getBoundingClientRect();
      const inputs = [...grid.querySelectorAll('input, select')];
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        gridRight: Math.round(rect.right),
        winW: window.innerWidth,
        widestInputRight: Math.round(
          Math.max(...inputs.map((el) => el.getBoundingClientRect().right))
        ),
        buttonWidth: Math.round(
          document.querySelector('.login-page button').getBoundingClientRect().width
        ),
        gridWidth: Math.round(rect.width),
      };
    });
    check(
      `${width}px: nessun overflow`,
      info.overflow <= 0,
      JSON.stringify(info)
    );
    check(
      `${width}px: campi dentro il viewport`,
      info.widestInputRight <= info.winW,
      JSON.stringify(info)
    );
    await page.screenshot({ path: `.workbuddy-ai/tests/personal-info-${width}.png` });
    await context.close();
  }
}

await browser.close();

console.log(`\n=== ${pass} PASS / ${failures.length} FAIL ===`);
if (failures.length) {
  for (const f of failures) console.log('  -', f);
  process.exitCode = 1;
}
