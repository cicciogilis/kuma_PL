import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAccessoryBlocks,
  formatAccessoryCount,
  formatAccessoryReps,
  formatAccessorySeries,
  sameAccessoryBlocks,
} from './accessoryForm.js';

const strip = (blocks) => blocks.map(({ sets, reps }) => ({ sets, reps }));

test('buildAccessoryBlocks: serie unica e rep multiple', () => {
  assert.deepEqual(
    strip(buildAccessoryBlocks('3', '4 + 2')),
    [{ sets: 3, reps: '4' }, { sets: 3, reps: '2' }]
  );
});

test('buildAccessoryBlocks: serie multiple e rep unica', () => {
  assert.deepEqual(
    strip(buildAccessoryBlocks('3 + 4', '6')),
    [{ sets: 3, reps: '6' }, { sets: 4, reps: '6' }]
  );
});

test('buildAccessoryBlocks: serie e rep appaiate', () => {
  assert.deepEqual(
    strip(buildAccessoryBlocks('3 + 4', '4 + 2')),
    [{ sets: 3, reps: '4' }, { sets: 4, reps: '2' }]
  );
});

test('buildAccessoryBlocks: notazione compatta 3x4 + 4x2', () => {
  assert.deepEqual(
    strip(buildAccessoryBlocks('3x4 + 4x2', '')),
    [{ sets: 3, reps: '4' }, { sets: 4, reps: '2' }]
  );
});

test('buildAccessoryBlocks: input vuoto o incoerente non produce blocchi', () => {
  assert.deepEqual(buildAccessoryBlocks('', '4'), []);
  assert.deepEqual(buildAccessoryBlocks('3 + 4', '4 + 2 + 1'), []);
});

test('formatAccessorySeries: serie uguali scritte una sola volta', () => {
  assert.equal(formatAccessorySeries([{ sets: 3, reps: '4' }, { sets: 3, reps: '2' }]), '3');
});

test('formatAccessorySeries: serie diverse elencate in ordine', () => {
  assert.equal(formatAccessorySeries([{ sets: 3, reps: '4' }, { sets: 4, reps: '2' }]), '3 + 4');
});

test('formatAccessorySeries/Reps: liste vuote o assenti', () => {
  assert.equal(formatAccessorySeries([]), '');
  assert.equal(formatAccessorySeries(undefined), '');
  assert.equal(formatAccessoryReps([]), '');
  assert.equal(formatAccessoryReps(null), '');
});

test('round-trip: blocchi -> testo -> blocchi identico', () => {
  const casi = [
    [{ sets: 3, reps: '4' }, { sets: 3, reps: '2' }],
    [{ sets: 3, reps: '4' }, { sets: 4, reps: '2' }],
    [{ sets: 4, reps: '6' }],
    [{ sets: 4, reps: '6' }, { sets: 3, reps: '8' }, { sets: 4, reps: '6' }],
  ];

  casi.forEach((blocks) => {
    const series = formatAccessorySeries(blocks);
    const reps = formatAccessoryReps(blocks);
    assert.deepEqual(strip(buildAccessoryBlocks(series, reps)), blocks, `${series} / ${reps}`);
  });
});

test('sameAccessoryBlocks: confronta serie e rep, non i metadati', () => {
  const original = [{ sets: 3, reps: '4', percent: 75 }, { sets: 4, reps: '2' }];
  const stesso = [{ sets: 3, reps: '4' }, { sets: 4, reps: '2' }];
  const diverso = [{ sets: 3, reps: '4' }, { sets: 5, reps: '2' }];

  assert.equal(sameAccessoryBlocks(stesso, original), true);
  assert.equal(sameAccessoryBlocks(diverso, original), false);
  assert.equal(sameAccessoryBlocks([], original), false);
  assert.equal(sameAccessoryBlocks(undefined, undefined), true);
});

test('formatAccessoryCount: singolare e plurale con la E maiuscola', () => {
  assert.equal(formatAccessoryCount(0), '0 Esercizi');
  assert.equal(formatAccessoryCount(1), '1 Esercizio');
  assert.equal(formatAccessoryCount(2), '2 Esercizi');
});
