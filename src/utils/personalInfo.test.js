import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REQUIRED_PERSONAL_FIELDS,
  getMissingPersonalFields,
  hasMissingPersonalInfo,
} from './personalInfo.js';

const completeProfile = {
  firstName: 'Marco',
  lastName: 'Moscheo',
  birthDate: '1990-05-12',
  gender: 'M',
  birthCity: 'Roma',
  birthProvince: 'RM',
};

test('i campi obbligatori sono esattamente i 6 anagrafici richiesti', () => {
  assert.deepEqual(REQUIRED_PERSONAL_FIELDS, [
    'firstName',
    'lastName',
    'birthDate',
    'gender',
    'birthCity',
    'birthProvince',
  ]);
});

test('un profilo completo non richiede la pagina Informazioni personali', () => {
  assert.equal(hasMissingPersonalInfo(completeProfile), false);
  assert.deepEqual(getMissingPersonalFields(completeProfile), []);
});

test('basta un solo campo mancante per bloccare l ingresso', () => {
  for (const field of REQUIRED_PERSONAL_FIELDS) {
    const profile = { ...completeProfile, [field]: '' };
    assert.equal(hasMissingPersonalInfo(profile), true, `campo ${field} svuotato`);
    assert.deepEqual(getMissingPersonalFields(profile), [field]);
  }
});

test('i campi assenti del tutto vengono segnalati come mancanti', () => {
  assert.deepEqual(getMissingPersonalFields({ firstName: 'Marco' }), [
    'lastName',
    'birthDate',
    'gender',
    'birthCity',
    'birthProvince',
  ]);
});

test('stringhe di soli spazi e valori nulli contano come mancanti', () => {
  assert.equal(hasMissingPersonalInfo({ ...completeProfile, firstName: '   ' }), true);
  assert.equal(hasMissingPersonalInfo({ ...completeProfile, lastName: null }), true);
  assert.equal(hasMissingPersonalInfo({ ...completeProfile, birthProvince: undefined }), true);
});

test('input vuoto o non oggetto non fa esplodere il controllo', () => {
  assert.equal(hasMissingPersonalInfo(), true);
  assert.equal(hasMissingPersonalInfo(null), true);
  assert.equal(getMissingPersonalFields().length, REQUIRED_PERSONAL_FIELDS.length);
});

test('il vecchio utente senza dati anagrafici viene intercettato', () => {
  // Profilo tipico creato prima dell'introduzione dei campi anagrafici.
  const legacyUser = { username: 'vecchio_utente', s: 100, b: 60, d: 140 };
  assert.equal(hasMissingPersonalInfo(legacyUser), true);
  assert.deepEqual(getMissingPersonalFields(legacyUser), REQUIRED_PERSONAL_FIELDS);
});
