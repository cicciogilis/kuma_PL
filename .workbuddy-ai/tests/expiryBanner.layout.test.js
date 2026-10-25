import { chromium } from 'file:///C:/Users/franc/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, 'expiryBanner.fixture.html');

const VIEWPORTS = [
  { width: 320, height: 700, name: 'iPhone SE' },
  { width: 390, height: 700, name: 'iPhone 14' },
  { width: 430, height: 700, name: 'iPhone 14 Pro Max' },
  { width: 480, height: 700, name: 'Breakpoint 480' },
  { width: 768, height: 700, name: 'iPad Mini' },
];

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  let allPassed = true;

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('file:///' + fixturePath.replace(/\\/g, '/'));
    await page.waitForTimeout(200);

    const results = await page.evaluate(() => {
      const cardPending = document.getElementById('card-pending');
      const cardSent = document.getElementById('card-sent');
      const pendingBtn = cardPending.querySelector('.program-expiry-action');
      const sentBtn = cardSent.querySelector('.program-expiry-action.sent');

      const cardPendingRect = cardPending.getBoundingClientRect();
      const cardSentRect = cardSent.getBoundingClientRect();
      const pendingRect = pendingBtn.getBoundingClientRect();
      const sentRect = sentBtn.getBoundingClientRect();

      return {
        pending: {
          right: pendingRect.right,
          cardRight: cardPendingRect.right,
          overflows: pendingRect.right > cardPendingRect.right + 0.5,
        },
        sent: {
          right: sentRect.right,
          cardRight: cardSentRect.right,
          overflows: sentRect.right > cardSentRect.right + 0.5,
        },
      };
    });

    if (results.pending.overflows) {
      console.log(`FAIL [${vp.name} ${vp.width}px] pending banner overflows: right=${results.pending.right}, cardRight=${results.pending.cardRight}`);
      allPassed = false;
    } else {
      console.log(`PASS [${vp.name} ${vp.width}px] pending banner fits`);
    }

    if (results.sent.overflows) {
      console.log(`FAIL [${vp.name} ${vp.width}px] sent banner overflows: right=${results.sent.right}, cardRight=${results.sent.cardRight}`);
      allPassed = false;
    } else {
      console.log(`PASS [${vp.name} ${vp.width}px] sent banner fits`);
    }
  }

  await browser.close();
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
