import { get, onValue, ref, remove, set, update } from 'firebase/database';
import { db } from './firebase';
import { loadCompletions, loadPrograms } from './programData';

// NOTA SICUREZZA: con le regole Firebase attuali (database.rules.json:
// .read/.write = true) questi dati sono leggibili e scrivibili da chiunque.
// Finché non si introduce Firebase Auth + regole per-path, i controlli di
// accesso restano solo lato interfaccia.

// Firebase non accetta `undefined`: facciamo un giro JSON per ripulire i payload.
const sanitize = (value) => JSON.parse(JSON.stringify(value ?? null));

const path = (...parts) => ['users', ...parts].join('/');

// Realtime DB non conserva gli array vuoti: ricostruisce la forma attesa.
const reviveArrays = (value) => {
  if (Array.isArray(value)) return value.map(reviveArrays);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => reviveArrays(value[key]));
    }
    const result = {};
    keys.forEach((key) => {
      result[key] = reviveArrays(value[key]);
    });
    return result;
  }
  return value;
};

const normalizeLift = (lift = {}) => ({
  ...lift,
  blocks: Array.isArray(lift?.blocks) ? lift.blocks : [],
});

const normalizeSession = (session = {}) => ({
  ...session,
  lifts: (Array.isArray(session?.lifts) ? session.lifts : []).map(normalizeLift),
});

const normalizeWeek = (week = {}) => ({
  ...week,
  sessions: (Array.isArray(week?.sessions) ? week.sessions : []).map(normalizeSession),
});

const normalizeProgram = (program) => {
  if (!program || typeof program !== 'object' || typeof program.id !== 'string') return null;
  const revived = reviveArrays(program);
  return {
    ...revived,
    weeks: (Array.isArray(revived.weeks) ? revived.weeks : []).map(normalizeWeek),
    complementari: Array.isArray(revived.complementari) ? revived.complementari : [],
  };
};

const sortPrograms = (programs) =>
  [...programs].sort((a, b) => {
    const aTime = Date.parse(a.startDate || '') || 0;
    const bTime = Date.parse(b.startDate || '') || 0;
    return bTime - aTime;
  });

export const normalizePrograms = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return sortPrograms(list.map(normalizeProgram).filter(Boolean));
};

const normalizeMap = (raw) =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

const removeEmpty = (nodePath) => remove(ref(db, nodePath));

// --- Programmazioni ---------------------------------------------------------

export const subscribePrograms = (userKey, onData, onError) => {
  if (!userKey) return () => {};
  return onValue(
    ref(db, path(userKey, 'programs')),
    (snapshot) => onData(normalizePrograms(snapshot.val())),
    (error) => {
      console.error('Errore durante la lettura delle programmazioni:', error);
      onError?.(error);
    }
  );
};

// Scrittura per singolo programma: evita di sovrascrivere l'intero elenco
// (e quindi di perdere schede create in parallelo da altri dispositivi).
export const saveProgram = (userKey, program) =>
  set(ref(db, path(userKey, 'programs', program.id)), sanitize(program));

// --- Completamenti ----------------------------------------------------------

export const subscribeCompletions = (userKey, onData, onError) => {
  if (!userKey) return () => {};
  return onValue(
    ref(db, path(userKey, 'completions')),
    (snapshot) => onData(normalizeMap(snapshot.val())),
    (error) => {
      console.error('Errore durante la lettura dei completamenti:', error);
      onError?.(error);
    }
  );
};

export const saveCompletions = (userKey, completions) => {
  const payload = sanitize(completions);
  return Object.keys(payload || {}).length
    ? set(ref(db, path(userKey, 'completions')), payload)
    : removeEmpty(path(userKey, 'completions'));
};

// --- Note atleta -> coach ---------------------------------------------------

export const subscribeProgramNotes = (userKey, onData, onError) => {
  if (!userKey) return () => {};
  return onValue(
    ref(db, path(userKey, 'programNotes')),
    (snapshot) => onData(normalizeMap(snapshot.val())),
    (error) => {
      console.error('Errore durante la lettura delle note:', error);
      onError?.(error);
    }
  );
};

export const saveProgramNote = (userKey, programId, text, updatedBy) =>
  set(ref(db, path(userKey, 'programNotes', programId)), {
    text: String(text ?? '').slice(0, 1000),
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || '',
  });

// --- Avvisi di scadenza -----------------------------------------------------

export const subscribeExpiryNotices = (userKey, onData, onError) => {
  if (!userKey) return () => {};
  return onValue(
    ref(db, path(userKey, 'expiryNotices')),
    (snapshot) => onData(normalizeMap(snapshot.val())),
    (error) => {
      console.error('Errore durante la lettura degli avvisi di scadenza:', error);
      onError?.(error);
    }
  );
};

export const sendExpiryNotice = (userKey, programId, coachKey, coachName) =>
  set(ref(db, path(userKey, 'expiryNotices', programId)), {
    sentAt: new Date().toISOString(),
    coachKey: coachKey || null,
    coachName: coachName || null,
    resolvedAt: null,
    resolvedByProgramId: null,
  });

// Quando il coach inserisce una nuova programmazione per l'atleta, gli avvisi
// inviati prima di quel momento vengono considerati risolti.
export const resolveExpiryNoticesForCoachProgram = async (
  userKey,
  newProgramCreatedAt,
  newProgramId
) => {
  if (!userKey || !newProgramCreatedAt) return;
  const snapshot = await get(ref(db, path(userKey, 'expiryNotices')));
  const notices = normalizeMap(snapshot.val());
  const updates = {};
  Object.entries(notices).forEach(([programId, notice]) => {
    if (!notice || notice.resolvedAt) return;
    if (programId === newProgramId) return;
    const sentAt = Date.parse(notice.sentAt || '') || 0;
    const created = Date.parse(newProgramCreatedAt) || 0;
    if (sentAt && sentAt <= created) {
      updates[path(userKey, 'expiryNotices', programId, 'resolvedAt')] = new Date().toISOString();
      updates[path(userKey, 'expiryNotices', programId, 'resolvedByProgramId')] = newProgramId || null;
    }
  });
  if (Object.keys(updates).length) await update(ref(db), updates);
};

// Indica se l'atleta ha modificato o completato una scheda creata dal coach.
export const programAthleteActivity = (program, completions) => {
  const completionsCount = Object.keys(completions || {})
    .filter((key) => key.startsWith(`${program.id}:`)).length;
  return {
    completions: completionsCount,
    hasNote: false,
    modified: Boolean(program.athleteUpdatedAt),
  };
};

// --- Eliminazione completa di una programmazione ----------------------------

export const deleteProgramFully = async (userKey, programId) => {
  if (!userKey || !programId) return;
  const snapshot = await get(ref(db, `users/${userKey}/completions`));
  const completions = normalizeMap(snapshot.val());

  const updates = {};
  Object.keys(completions).forEach((key) => {
    if (key.startsWith(`${programId}:`)) {
      updates[path(userKey, 'completions', key)] = null;
    }
  });
  updates[path(userKey, 'programs', programId)] = null;
  updates[path(userKey, 'programNotes', programId)] = null;
  updates[path(userKey, 'expiryNotices', programId)] = null;
  await update(ref(db), updates);
};

// --- Migrazione una tantum da localStorage ----------------------------------

export const migrateLocalPrograms = async (userKey) => {
  if (!userKey) return { migrated: false };
  try {
    const localPrograms = loadPrograms(userKey);
    const localCompletions = loadCompletions(userKey);
    if (!localPrograms.length && !Object.keys(localCompletions).length) {
      return { migrated: false };
    }

    const snapshot = await get(ref(db, `users/${userKey}`));
    const data = snapshot.val() || {};
    const remotePrograms = normalizePrograms(data.programs);
    const remoteCompletions = normalizeMap(data.completions);

    const updates = {};
    if (!remotePrograms.length && localPrograms.length) {
      localPrograms.forEach((program) => {
        const withAuthor = { authorRole: 'athlete', ...program };
        updates[path(userKey, 'programs', withAuthor.id)] = sanitize(withAuthor);
      });
    }
    if (!Object.keys(remoteCompletions).length && Object.keys(localCompletions).length) {
      updates[path(userKey, 'completions')] = sanitize(localCompletions);
    }

    if (Object.keys(updates).length) {
      await update(ref(db), updates);
      return { migrated: true };
    }
    return { migrated: false };
  } catch (error) {
    console.error('Errore durante la migrazione dei dati locali:', error);
    return { migrated: false, error };
  }
};
