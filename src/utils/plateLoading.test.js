import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BAR_WEIGHT,
  calculatePlateLoad,
} from './plateLoading.js';

test('110 kg con bilanciere da 20 kg carica 25 + 20 per lato', () => {
  const load = calculatePlateLoad(110);

  assert.equal(load.error, '');
  assert.equal(load.perSide, 45);
  assert.deepEqual(load.plates.map((plate) => plate.weight), [25, 20]);
  assert.equal(load.loadedTotal, 110);
  assert.equal(load.remainderTotal, 0);
  assert.equal(load.exact, true);
});

test('100 kg usa i dischi più grandi disponibili', () => {
  const load = calculatePlateLoad('100');

  assert.deepEqual(load.plates.map((plate) => plate.weight), [25, 15]);
  assert.equal(load.loadedTotal, 100);
  assert.equal(load.exact, true);
});

test('il solo bilanciere non richiede dischi', () => {
  const load = calculatePlateLoad(BAR_WEIGHT);

  assert.deepEqual(load.plates, []);
  assert.equal(load.loadedTotal, BAR_WEIGHT);
  assert.equal(load.exact, true);
});

test('un carico non ottenibile segnala il resto', () => {
  const load = calculatePlateLoad('21');

  assert.deepEqual(load.plates, []);
  assert.equal(load.loadedTotal, BAR_WEIGHT);
  assert.equal(load.remainderTotal, 1);
  assert.equal(load.exact, false);
});

test('un carico inferiore al bilanciere restituisce un errore', () => {
  const load = calculatePlateLoad(15);

  assert.match(load.error, /carico minimo/i);
  assert.deepEqual(load.plates, []);
});

test('accetta la virgola come separatore decimale', () => {
  const load = calculatePlateLoad('22,5');

  assert.deepEqual(load.plates.map((plate) => plate.weight), [1.25]);
  assert.equal(load.loadedTotal, 22.5);
  assert.equal(load.exact, true);
});

test('400 kg carica il lato singolo con 8 dischi', () => {
  const load = calculatePlateLoad(400);

  assert.deepEqual(
    load.plates.map((plate) => plate.weight),
    [25, 25, 25, 25, 25, 25, 25, 15]
  );
  assert.equal(load.perSide, 190);
  assert.equal(load.loadedTotal, 400);
  assert.equal(load.exact, true);
});

test('la Safety Bar da 29 kg usa il peso corretto', () => {
  const load = calculatePlateLoad(129, { barWeight: 29 });

  assert.equal(load.barWeight, 29);
  assert.equal(load.perSide, 50);
  assert.deepEqual(load.plates.map((plate) => plate.weight), [25, 25]);
  assert.equal(load.loadedTotal, 129);
  assert.equal(load.exact, true);
});

test('la Cambered & Bow Bar da 25 kg usa il peso corretto', () => {
  const load = calculatePlateLoad(115, { barWeight: 25 });

  assert.equal(load.barWeight, 25);
  assert.equal(load.perSide, 45);
  assert.deepEqual(load.plates.map((plate) => plate.weight), [25, 20]);
  assert.equal(load.loadedTotal, 115);
  assert.equal(load.exact, true);
});
