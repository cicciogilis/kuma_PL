import assert from 'node:assert/strict';
import test from 'node:test';

import { RANGE_FILTERS, matchesRange } from './teamFilters.js';

test('i filtri coprono tutte le fasce richieste', () => {
  assert.deepEqual(
    RANGE_FILTERS.map((item) => item.label),
    [
      'Tutte',
      'Tra 1 settimana',
      'Tra 2 settimane',
      'Tra 3 settimane',
      'Scadute',
      'Scadute da 1 settimana',
      'Scadute da 2 settimane',
    ]
  );
});

test('"Tra 1 settimana" prende solo 0-7 giorni', () => {
  assert.equal(matchesRange(0, 'w1'), true);
  assert.equal(matchesRange(7, 'w1'), true);
  assert.equal(matchesRange(8, 'w1'), false);
  assert.equal(matchesRange(-1, 'w1'), false);
});

test('"Tra 2 settimane" prende 8-14 giorni, non 0-7', () => {
  assert.equal(matchesRange(8, 'w2'), true);
  assert.equal(matchesRange(14, 'w2'), true);
  assert.equal(matchesRange(7, 'w2'), false);
  assert.equal(matchesRange(15, 'w2'), false);
});

test('"Tra 3 settimane" prende 15-21 giorni', () => {
  assert.equal(matchesRange(15, 'w3'), true);
  assert.equal(matchesRange(21, 'w3'), true);
  assert.equal(matchesRange(14, 'w3'), false);
  assert.equal(matchesRange(22, 'w3'), false);
});

test('"Scadute" prende solo i giorni negativi', () => {
  assert.equal(matchesRange(-1, 'expired'), true);
  assert.equal(matchesRange(-40, 'expired'), true);
  assert.equal(matchesRange(0, 'expired'), false);
  assert.equal(matchesRange(5, 'expired'), false);
});

test('"Scadute da 1 settimana" prende -7..-1', () => {
  assert.equal(matchesRange(-1, 'expired1'), true);
  assert.equal(matchesRange(-7, 'expired1'), true);
  assert.equal(matchesRange(-8, 'expired1'), false);
  assert.equal(matchesRange(1, 'expired1'), false);
});

test('"Scadute da 2 settimane" prende -14..-8', () => {
  assert.equal(matchesRange(-8, 'expired2'), true);
  assert.equal(matchesRange(-14, 'expired2'), true);
  assert.equal(matchesRange(-7, 'expired2'), false);
  assert.equal(matchesRange(-15, 'expired2'), false);
});

test('le fasce future sono disgiunte: ogni giorno cade in un solo filtro', () => {
  for (let days = 0; days <= 21; days += 1) {
    const hits = ['w1', 'w2', 'w3'].filter((key) => matchesRange(days, key));
    assert.equal(hits.length, 1, `giorno ${days} in ${JSON.stringify(hits)}`);
  }
});

test('oltre 21 giorni nessuna fascia "Tra N settimane" si attiva', () => {
  for (let days = 22; days <= 40; days += 1) {
    const hits = ['w1', 'w2', 'w3'].filter((key) => matchesRange(days, key));
    assert.equal(hits.length, 0, `giorno ${days} in ${JSON.stringify(hits)}`);
  }
});

test('le fasce "scadute" sono disgiunte e "Scadute" le contiene tutte', () => {
  for (let days = -20; days <= -1; days += 1) {
    assert.equal(matchesRange(days, 'expired'), true, `giorno ${days} fuori da Scadute`);
  }
  for (let days = -14; days <= -1; days += 1) {
    const hits = ['expired1', 'expired2'].filter((key) => matchesRange(days, key));
    assert.equal(hits.length, 1, `giorno ${days} in ${JSON.stringify(hits)}`);
  }
});

test('"Tutte" accetta tutto, ma non i dati mancanti', () => {
  assert.equal(matchesRange(-100, 'all'), true);
  assert.equal(matchesRange(0, 'all'), true);
  assert.equal(matchesRange(100, 'all'), true);
  assert.equal(matchesRange(null, 'all'), false);
  assert.equal(matchesRange(undefined, 'w1'), false);
});
