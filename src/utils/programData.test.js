import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXPIRY_NOTICE_DAYS,
  getProgramEndDate,
  isProgramEndingSoon,
} from './programData.js';
import { formatSuArticolo } from './programDisplay.js';

const makeProgram = (startDate, weeks) => ({
  startDate,
  weeks: Array.from({ length: weeks }, (_, index) => ({
    week: index + 1,
    sessions: [{ day: 'Lun', exercises: [] }],
  })),
});

test('l avviso di scadenza parte solo nell ultima settimana', () => {
  assert.equal(EXPIRY_NOTICE_DAYS, 7);
});

test('scheda di 6 settimane: avviso solo a 7 giorni dalla fine', () => {
  const program = makeProgram('2026-01-01', 6);
  const end = getProgramEndDate(program);
  assert.ok(end instanceof Date);

  const dayFromEnd = (offset) => {
    const date = new Date(end);
    date.setDate(date.getDate() + offset);
    date.setHours(12, 0, 0, 0);
    return date;
  };

  assert.equal(isProgramEndingSoon(program, dayFromEnd(-14)), false, 'a due settimane');
  assert.equal(isProgramEndingSoon(program, dayFromEnd(-8)), false, 'a otto giorni');
  assert.equal(isProgramEndingSoon(program, dayFromEnd(-7)), true, 'a sette giorni');
  assert.equal(isProgramEndingSoon(program, dayFromEnd(0)), true, 'il giorno della fine');
  assert.equal(isProgramEndingSoon(program, dayFromEnd(1)), false, 'dopo la fine');
});

test('una scheda non ancora iniziata non e in scadenza', () => {
  const program = makeProgram('2026-01-01', 6);
  assert.equal(isProgramEndingSoon(program, new Date(2025, 11, 20, 12)), false);
});

test('articolo "su" davanti al numero: vocalico -> sull apostrofo', () => {
  assert.equal(formatSuArticolo('1'), "sull'");
  assert.equal(formatSuArticolo('8'), "sull'");
  assert.equal(formatSuArticolo('11'), "sull'");
  assert.equal(formatSuArticolo('80'), "sull'");
  assert.equal(formatSuArticolo('8 @8'), "sull'");
  assert.equal(formatSuArticolo('8×5'), "sull'");
});

test('articolo "su" davanti al numero: consonantico -> sul', () => {
  assert.equal(formatSuArticolo('5'), 'sul ');
  assert.equal(formatSuArticolo('10'), 'sul ');
  assert.equal(formatSuArticolo('12'), 'sul ');
  assert.equal(formatSuArticolo('18'), 'sul ');
  assert.equal(formatSuArticolo('21'), 'sul ');
  assert.equal(formatSuArticolo('5×8'), 'sul ');
});

test('riferimento assente o non numerico resta "sul "', () => {
  assert.equal(formatSuArticolo(''), 'sul ');
  assert.equal(formatSuArticolo(null), 'sul ');
  assert.equal(formatSuArticolo(undefined), 'sul ');
  assert.equal(formatSuArticolo('@8'), 'sul ');
});
