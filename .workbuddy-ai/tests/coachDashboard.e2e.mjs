// Verifica grafica (fixture con i CSS reali) dei due bug della dashboard allenatore:
// 1) header "Week N" che deve occupare tutta la linea della tabella (web orizzontale)
// 2) username atleta a capo, sotto il nome, nella casella di selezione eventi
import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const url = 'file:///C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App%20Kuma%20CiccioBart/kuma_PL/.workbuddy-ai/tests/coachDashboard.fixture.html';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name} ${extra}`); }
};

const browser = await chromium.launch();

for (const width of [1280, 1024, 768, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(120);
  console.log(`\n=== ${width}px ===`);

  const week = await page.evaluate(() => {
    const table = document.querySelector('.program-matrix');
    const heads = [...document.querySelectorAll('.program-matrix-week-head')];
    const cells = [...document.querySelectorAll('.program-matrix-week th')];
    const dayCell = document.querySelector('.program-matrix-day');
    const titles = [...document.querySelectorAll('.program-matrix-week-title')];
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width, h: r.height, right: r.right }; };
    const padLeft = parseFloat(getComputedStyle(cells[0]).paddingLeft);
    const padRight = parseFloat(getComputedStyle(cells[0]).paddingRight);
    return {
      table: rect(table),
      head0: rect(heads[0]),
      cell0: rect(cells[0]),
      head1: rect(heads[1]),
      title1: rect(titles[1]),
      dayCell: rect(dayCell),
      padLeft,
      padRight,
      tableDisplay: getComputedStyle(table).display,
      thDisplay: getComputedStyle(cells[0]).display,
      headDisplay: getComputedStyle(heads[0]).display,
      titleWrap: titles.map((t) => t.scrollWidth > t.clientWidth + 1),
      titleHeight: titles.map((t) => Math.round(t.getBoundingClientRect().height)),
    };
  });

  // La th deve restare una cella di tabella (display flex la estrometteva).
  check('th resta cella di tabella', week.thDisplay !== 'flex', `display=${week.thDisplay}`);
  check('head è flex', week.headDisplay === 'flex', `display=${week.headDisplay}`);

  if (width > 720) {
    // Desktop: la cella "Week N" deve coprire la larghezza della tabella, non la colonna Giorno.
    check('cella Week larga quanto la tabella', Math.abs(week.cell0.w - week.table.w) < 4,
      `cella=${week.cell0.w.toFixed(1)} table=${week.table.w.toFixed(1)}`);
    check('cella Week parte dal bordo sinistro', Math.abs(week.cell0.x - week.table.x) < 2,
      `cella=${week.cell0.x.toFixed(1)} table=${week.table.x.toFixed(1)}`);
    check('cella Week più larga della colonna Giorno', week.cell0.w > week.dayCell.w * 2,
      `week=${week.cell0.w.toFixed(1)} giorno=${week.dayCell.w.toFixed(1)}`);
    check('contenuto header usa tutta la cella (meno padding)',
      Math.abs(week.head0.w - (week.cell0.w - week.padLeft - week.padRight)) < 2,
      `head=${week.head0.w.toFixed(1)} atteso=${(week.cell0.w - week.padLeft - week.padRight).toFixed(1)}`);
  }

  check('titoli Week su una sola riga', week.titleWrap.every((wrapped) => wrapped === false),
    JSON.stringify(week.titleWrap));
  check('altezza titolo singola riga', week.titleHeight.every((h) => h <= 20), JSON.stringify(week.titleHeight));
  check('"Week 12" non compresso', week.title1.w > 40, `w=${week.title1.w.toFixed(1)}`);

  const athlete = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.team-events-athlete')];
    return rows.map((row) => {
      const span = row.querySelector('span');
      const small = row.querySelector('small');
      const r = row.getBoundingClientRect();
      const sr = span.getBoundingClientRect();
      const mr = small.getBoundingClientRect();
      const spanStyle = getComputedStyle(span);
      const smallStyle = getComputedStyle(small);
      return {
        rowH: r.height,
        spanDisplay: spanStyle.display,
        spanDir: spanStyle.flexDirection,
        smallFont: parseFloat(smallStyle.fontSize),
        spanFont: parseFloat(getComputedStyle(row).fontSize),
        smallOnOwnLine: mr.top >= sr.top + 8,
        smallRight: mr.right,
        rowRight: r.right,
        overflow: small.scrollWidth > small.clientWidth + 1,
      };
    });
  });

  check('username sotto il nome (colonna)', athlete.every((a) => a.spanDisplay === 'flex' && a.spanDir === 'column'),
    JSON.stringify(athlete.map((a) => `${a.spanDisplay}/${a.spanDir}`)));
  check('username su riga propria', athlete.every((a) => a.smallOnOwnLine),
    JSON.stringify(athlete.map((a) => a.smallOnOwnLine)));
  check('username più piccolo del nome', athlete.every((a) => a.smallFont < a.spanFont),
    JSON.stringify(athlete.map((a) => `${a.smallFont}<${a.spanFont}`)));
  check('username non esce dalla casella', athlete.every((a) => a.smallRight <= a.rowRight + 1),
    JSON.stringify(athlete.map((a) => `${a.smallRight.toFixed(1)}<=${a.rowRight.toFixed(1)}`)));

  await page.close();
}

await browser.close();
console.log(`\n# pass ${pass} / fail ${fail}`);
process.exit(fail === 0 ? 0 : 1);
