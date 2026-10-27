// Dati anagrafici richiesti per entrare nell'app.
// Se ne manca anche uno solo, dopo il login l'atleta viene fermato sulla
// pagina "Informazioni personali" prima di vedere il benvenuto/massimali.
export const REQUIRED_PERSONAL_FIELDS = [
  'firstName',
  'lastName',
  'birthDate',
  'gender',
  'birthCity',
  'birthProvince',
];

// Etichette usate nei messaggi e nei test, nello stesso ordine dei campi.
export const PERSONAL_FIELD_LABELS = {
  firstName: 'Nome',
  lastName: 'Cognome',
  birthDate: 'Data di nascita',
  gender: 'Genere',
  birthCity: 'Città di nascita',
  birthProvince: 'Provincia',
};

const isBlank = (value) => !String(value ?? '').trim();

// Elenco dei campi mancanti (vuoto se il profilo è completo).
export const getMissingPersonalFields = (userData = {}) =>
  REQUIRED_PERSONAL_FIELDS.filter((field) => isBlank(userData?.[field]));

export const hasMissingPersonalInfo = (userData = {}) =>
  getMissingPersonalFields(userData).length > 0;
