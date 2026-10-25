import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = join(__dirname, '..', '..', 'src', 'Programmazioni.css');
const css = readFileSync(cssPath, 'utf8');

function extractBlock(cssText, selector) {
  const regex = new RegExp(`^${selector.replace(/\./g, '\\.')}(?:,[^\\{]+)?\\s*\\{([^}]+)\\}`, 'm');
  const match = cssText.match(regex);
  return match ? match[1] : '';
}

function extractMediaBlock(cssText, mediaQuery, selector) {
  const header = `@media ${mediaQuery} {`;
  let searchFrom = 0;
  let inner = '';
  while (true) {
    const start = cssText.indexOf(header, searchFrom);
    if (start === -1) break;
    let depth = 1;
    let pos = start + header.length;
    while (pos < cssText.length && depth > 0) {
      if (cssText[pos] === '{') depth++;
      else if (cssText[pos] === '}') depth--;
      pos++;
    }
    const candidate = cssText.slice(start + header.length, pos - 1);
    if (candidate.includes(selector)) {
      inner = candidate;
      break;
    }
    searchFrom = pos;
  }
  if (!inner) return '';
  const selectorRegex = new RegExp(`^\\s*${selector.replace(/\./g, '\\.')}(?:,[^\\{]+)?\\s*\\{([^}]+)\\}`, 'm');
  const selMatch = inner.match(selectorRegex);
  return selMatch ? selMatch[1] : '';
}

test('program-expiry-action base: no absolute positioning, no nowrap, has box-sizing and max-width', () => {
  const block = extractBlock(css, '.program-expiry-action');
  assert.ok(block.includes('box-sizing: border-box'), 'Missing box-sizing');
  assert.ok(block.includes('max-width: 100%'), 'Missing max-width: 100%');
  assert.ok(!block.includes('position: absolute'), 'Must not use position: absolute');
  assert.ok(!block.includes('white-space: nowrap'), 'Must not use white-space: nowrap');
  assert.ok(block.includes('border-radius: 12px'), 'Must use border-radius: 12px (not pill)');
});

test('program-expiry-action.sent base: only color overrides, no geometry divergence', () => {
  const block = extractBlock(css, '.program-expiry-action.sent');
  assert.ok(!block.includes('border-radius'), '.sent must not redeclare border-radius');
  assert.ok(!block.includes('padding'), '.sent must not redeclare padding');
  assert.ok(!block.includes('font-size'), '.sent must not redeclare font-size');
  assert.ok(!block.includes('position: absolute'), '.sent must not use position: absolute');
});

test('mobile media query: both states use normal flow, same geometry, no absolute', () => {
  const pending = extractMediaBlock(css, '(max-width: 480px)', '.program-expiry-action');
  const sent = extractMediaBlock(css, '(max-width: 480px)', '.program-expiry-action.sent');

  assert.ok(pending.includes('width: 100%'), 'Pending must be width: 100% on mobile');
  assert.ok(!pending.includes('position: absolute'), 'Pending must not be absolute on mobile');
  assert.ok(!sent.includes('position: absolute'), 'Sent must not be absolute on mobile');
  assert.ok(!sent.includes('left:'), 'Sent must not use left offset on mobile');
  assert.ok(!sent.includes('right:'), 'Sent must not use right offset on mobile');

  const pendingPad = pending.match(/padding:\s*([^;]+)/)?.[1]?.trim();
  const sentPad = sent.match(/padding:\s*([^;]+)/)?.[1]?.trim();
  assert.ok(
    !sentPad || sentPad === pendingPad,
    'Sent must not declare a different padding than pending on mobile'
  );

  const pendingSize = pending.match(/font-size:\s*([^;]+)/)?.[1]?.trim();
  const sentSize = sent.match(/font-size:\s*([^;]+)/)?.[1]?.trim();
  assert.ok(
    !sentSize || sentSize === pendingSize,
    'Sent must not declare a different font-size than pending on mobile'
  );
});

test('mobile media query: no :has() padding hack for sent banner', () => {
  assert.ok(!css.includes(':has(.program-expiry-action.sent)'), 'Must not use :has() padding hack');
});
