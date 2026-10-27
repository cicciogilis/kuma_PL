// Verifica le fix di "Strumenti allenamento".
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
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

const openTools = async (page, width) => {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.setItem('username', 'qa_switch_test');
    localStorage.setItem('password', 'QaTest1234');
    // peso che non si chiude esatto: serve la nota "resta"
    localStorage.setItem('kuma_workout_tools_plate_weight', JSON.stringify('193'));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4500);
  await page.locator('.menu-bar button[aria-label="Programmazioni"]').click();
  await page.waitForTimeout(600);
  await page.locator('.wt-fab').click();
  await page.waitForTimeout(800);
};

const newPage = async (width) => {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  return { context, page: await context.newPage() };
};

for (const width of [390, 320, 1280]) {
  console.log(`\n=== ${width}px ===`);
  const { context, page } = await newPage(width);
  await openTools(page, width);

  // ---- nota dischi
  const note = await page.evaluate(() => {
    const p = document.querySelector('.wt-plate-note.wt-summary-warn');
    if (!p) return null;
    const labels = [...p.querySelectorAll('.wt-note-label')];
    const values = [...p.querySelectorAll('.wt-note-value')];
    return {
      text: p.textContent.replace(/\s+/g, ' ').trim(),
      labelColors: labels.map((el) => getComputedStyle(el).color),
      valueColors: values.map((el) => getComputedStyle(el).color),
      labelTexts: labels.map((el) => el.textContent),
    };
  });
  check('nota dischi presente', Boolean(note), JSON.stringify(note));
  if (note) {
    check('dice "resta" e non "resto"', /· resta/.test(note.text) && !/resto/.test(note.text), note.text);
    check(
      'etichette in bianco',
      note.labelColors.every((c) => c === 'rgb(232, 232, 232)'),
      JSON.stringify(note.labelColors)
    );
    check(
      'valori in giallo',
      note.valueColors.every((c) => c === 'rgb(251, 191, 36)'),
      JSON.stringify(note.valueColors)
    );
  }

  // ---- percentuali: prima riga solo 50 e 60
  const rows = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.wt-calc-shortcut')];
    const tops = [...new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top)))];
    return tops.map((top) =>
      buttons
        .filter((b) => Math.round(b.getBoundingClientRect().top) === top)
        .map((b) => b.textContent.trim())
    );
  });
  check(
    'prima riga percentuali = 50%, 60%',
    JSON.stringify(rows[0]) === JSON.stringify(['50%', '60%']),
    JSON.stringify(rows)
  );
  check(
    'riga successiva = gli altri sei',
    JSON.stringify(rows[1]) === JSON.stringify(['70%', '75%', '80%', '85%', '90%', '95%']),
    JSON.stringify(rows)
  );

  // ---- virgola: nessun avanzamento da cifra tabellare
  await page.locator('.wt-calc-key', { hasText: '1' }).first().click();
  await page.locator('.wt-calc-key[aria-label="Virgola decimale"]').click();
  await page.locator('.wt-calc-key', { hasText: '5' }).first().click();
  await page.waitForTimeout(200);
  const comma = await page.evaluate(() => {
    const v = document.querySelector('.wt-calc-value');
    const cs = getComputedStyle(v);
    // larghezza reale di "1,5" rispetto a "115": se la virgola occupa una
    // cifra intera il rapporto si avvicina a 1
    const span = document.createElement('span');
    span.style.cssText = `position:absolute;visibility:hidden;font:${cs.font};letter-spacing:${cs.letterSpacing};font-variant-numeric:${cs.fontVariantNumeric}`;
    span.textContent = '1,5';
    document.body.appendChild(span);
    const withComma = span.getBoundingClientRect().width;
    span.textContent = '111';
    const digits = span.getBoundingClientRect().width;
    span.remove();
    return {
      text: v.textContent,
      fontVariant: cs.fontVariantNumeric,
      withComma: Math.round(withComma * 10) / 10,
      digits: Math.round(digits * 10) / 10,
    };
  });
  check('display mostra 1,5', comma.text === '1,5', comma.text);
  check('niente tabular-nums', comma.fontVariant === 'normal', comma.fontVariant);
  check(
    'virgola più stretta di una cifra',
    comma.withComma < comma.digits - 2,
    JSON.stringify(comma)
  );

  // ---- riempimento orizzontale (solo mobile)
  if (width <= 560) {
    const fill = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        const b = el.getBoundingClientRect();
        return { left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) };
      };
      const card = document.querySelector('.wt-plate-card');
      const pad = parseFloat(getComputedStyle(card).paddingLeft);
      const inner = {
        left: Math.round(card.getBoundingClientRect().left + pad),
        right: Math.round(card.getBoundingClientRect().right - pad),
      };
      const clockCard = document.querySelector('.wt-clock-card');
      const clockPad = parseFloat(getComputedStyle(clockCard).paddingLeft);
      const clockInner = {
        left: Math.round(clockCard.getBoundingClientRect().left + clockPad),
        right: Math.round(clockCard.getBoundingClientRect().right - clockPad),
      };
      return {
        inner,
        clockInner,
        controls: box('.wt-plate-controls'),
        barPicker: box('.wt-bar-picker'),
        blocks: box('.wt-blocks-toggle'),
        presets: box('.wt-presets'),
        actions: box('.wt-clock-actions'),
        presetCount: document.querySelectorAll('.wt-preset').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    check(
      'selettore+blocchi occupano tutta la riga',
      Math.abs(fill.controls.left - fill.inner.left) <= 1 &&
        Math.abs(fill.controls.right - fill.inner.right) <= 1,
      JSON.stringify(fill)
    );
    check(
      'selettore bilanciere largo almeno 120px',
      fill.barPicker.w >= 120,
      JSON.stringify(fill.barPicker)
    );
    check(
      'blocchi larghi almeno 70px',
      fill.blocks.w >= 70,
      JSON.stringify(fill.blocks)
    );
    check(
      'preset occupano tutta la riga',
      Math.abs(fill.presets.left - fill.clockInner.left) <= 1 &&
        Math.abs(fill.presets.right - fill.clockInner.right) <= 1,
      JSON.stringify(fill.presets)
    );
    check(
      'pulsanti timer occupano tutta la riga',
      Math.abs(fill.actions.left - fill.clockInner.left) <= 1 &&
        Math.abs(fill.actions.right - fill.clockInner.right) <= 1,
      JSON.stringify(fill.actions)
    );
    check('nessun overflow orizzontale', fill.overflow <= 0, String(fill.overflow));

    const tabs = await page.evaluate(() => {
      const box = document.querySelector('.wt-clock-tabs');
      const card = document.querySelector('.wt-clock-card');
      const pad = parseFloat(getComputedStyle(card).paddingLeft);
      const b = box.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const items = [...box.querySelectorAll('.wt-clock-tab')].map((el) =>
        Math.round(el.getBoundingClientRect().width)
      );
      return {
        left: Math.round(b.left),
        right: Math.round(b.right),
        innerLeft: Math.round(c.left + pad),
        innerRight: Math.round(c.right - pad),
        items,
      };
    });
    check(
      'tab Timer/Cronometro occupano tutta la riga',
      Math.abs(tabs.left - tabs.innerLeft) <= 1 && Math.abs(tabs.right - tabs.innerRight) <= 1,
      JSON.stringify(tabs)
    );
    check(
      'i due tab hanno la stessa larghezza',
      tabs.items.length === 2 && Math.abs(tabs.items[0] - tabs.items[1]) <= 1,
      JSON.stringify(tabs.items)
    );
  }

  await page.screenshot({ path: `.workbuddy-ai/tests/wt-after-${width}.png` });
  await context.close();
}

// ---- stop del timer: torna all'intervallo scelto + rilascio del focus audio
console.log('\n=== stop timer ===');
{
  const { context, page } = await newPage(390);
  // Spia su Audio: registra play/pause/load/removeAttribute per verificare che
  // allo stop la sorgente venga davvero staccata (altrimenti la musica delle
  // altre app resta abbassata dal ducking).
  await context.addInitScript(() => {
    window.__audioLog = [];
    const NativeAudio = window.Audio;
    window.Audio = function AudioSpy(...args) {
      const element = new NativeAudio(...args);
      ['play', 'pause', 'load'].forEach((name) => {
        const original = element[name].bind(element);
        element[name] = (...callArgs) => {
          window.__audioLog.push(name);
          return original(...callArgs);
        };
      });
      const removeAttribute = element.removeAttribute.bind(element);
      element.removeAttribute = (name) => {
        window.__audioLog.push(`remove:${name}`);
        return removeAttribute(name);
      };
      return element;
    };
  });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.setItem('username', 'qa_switch_test');
    localStorage.setItem('password', 'QaTest1234');
    // timer da 4 minuti già scaduto
    localStorage.setItem(
      'kuma_workout_tools_clock',
      JSON.stringify({
        mode: 'timer',
        timerPreset: 4,
        timerRemaining: 0,
        timerRunning: true,
        timerEndsAt: Date.now() - 2000,
        alarmRinging: false,
        stopwatchRunning: false,
        stopwatchStartedAt: null,
        stopwatchElapsed: 0,
      })
    );
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4500);
  await page.locator('.menu-bar button[aria-label="Programmazioni"]').click();
  await page.waitForTimeout(600);
  await page.locator('.wt-fab').click();
  await page.waitForTimeout(1200);

  const ringing = await page.locator('.wt-action-button.stop').count();
  check('la sveglia scatta alla riapertura con timer scaduto', ringing === 1);

  const dialBefore = await page.locator('.wt-dial-time').textContent();
  check('prima dello stop il quadrante è a 00:00', dialBefore === '00:00', String(dialBefore));

  const logBefore = await page.evaluate(() => window.__audioLog.slice());
  check('la sveglia ha avviato la riproduzione', logBefore.includes('play'), JSON.stringify(logBefore));

  await page.locator('.wt-action-button.stop').click();
  await page.waitForTimeout(500);

  const logAfter = await page.evaluate(() => window.__audioLog.slice());
  const tail = logAfter.slice(logBefore.length);
  check(
    'allo stop la sorgente audio viene staccata',
    tail.includes('remove:src') && tail.includes('load'),
    JSON.stringify(tail)
  );
  check('allo stop la riproduzione viene messa in pausa', tail.includes('pause'), JSON.stringify(tail));

  const dialAfter = await page.locator('.wt-dial-time').textContent();
  check('dopo lo stop torna a 04:00', dialAfter === '04:00', String(dialAfter));
  check('il pulsante Stop sparisce', (await page.locator('.wt-action-button.stop').count()) === 0);

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kuma_workout_tools_clock'))
  );
  check('stato persistito: 240s e non in esecuzione', stored.timerRemaining === 240 && !stored.timerRunning, JSON.stringify(stored));

  await page.screenshot({ path: '.workbuddy-ai/tests/wt-timer-stop.png' });
  await context.close();
}

await browser.close();
console.log(`\n=== ${pass} PASS / ${failures.length} FAIL ===`);
if (failures.length) process.exitCode = 1;
